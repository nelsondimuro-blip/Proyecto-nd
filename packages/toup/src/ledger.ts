/**
 * Ledger TOUP — double-entry append-only.
 *
 * Diseñado como interfaz pura: la lógica vive acá, la persistencia se inyecta
 * vía `LedgerStore`. Esto permite tests sin DB y backends intercambiables.
 */

import type { LedgerReason } from "@tn/shared";

export interface WalletState {
  id: string;
  balanceTOUP: number;
}

export interface LedgerEntry {
  id: string;
  debitWalletId: string;
  creditWalletId: string;
  amountTOUP: number;
  pegSnapshotARS: number;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  pending: boolean;
  createdAt: Date;
}

export interface LedgerStore {
  getWallet(id: string): Promise<WalletState | null>;
  updateBalance(id: string, delta: number): Promise<void>;
  appendEntry(entry: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry>;
  totalEmitido(): Promise<number>;
  sumaWallets(): Promise<number>;
  reservaTotalRollos(): Promise<number>;
  pegPrecioVigenteARS(): Promise<number>;
}

export class LedgerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "LedgerError";
  }
}

export interface TransferInput {
  fromWalletId: string;
  toWalletId: string;
  amountTOUP: number;
  pegSnapshotARS: number;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  pending?: boolean;
  allowNegativeFrom?: boolean;
}

/**
 * Transferencia: debita `from`, acredita `to`. En MINT, el `from` es la wallet
 * SYSTEM_RESERVE y se permite saldo negativo (la reserva es la contraparte
 * contable de la emisión).
 */
export async function transfer(
  store: LedgerStore,
  input: TransferInput,
): Promise<LedgerEntry> {
  if (input.amountTOUP <= 0) {
    throw new LedgerError("amountTOUP debe ser positivo", "INVALID_AMOUNT");
  }
  if (input.fromWalletId === input.toWalletId) {
    throw new LedgerError("from y to no pueden ser la misma wallet", "SAME_WALLET");
  }
  if (input.pegSnapshotARS <= 0) {
    throw new LedgerError("pegSnapshotARS debe ser positivo", "INVALID_PEG");
  }

  const fromW = await store.getWallet(input.fromWalletId);
  const toW = await store.getWallet(input.toWalletId);
  if (!fromW) throw new LedgerError(`Wallet ${input.fromWalletId} no existe`, "WALLET_NOT_FOUND");
  if (!toW) throw new LedgerError(`Wallet ${input.toWalletId} no existe`, "WALLET_NOT_FOUND");

  if (!input.allowNegativeFrom && fromW.balanceTOUP < input.amountTOUP) {
    throw new LedgerError(
      `Saldo insuficiente en wallet ${fromW.id} (${fromW.balanceTOUP} < ${input.amountTOUP})`,
      "INSUFFICIENT_FUNDS",
    );
  }

  const entry = await store.appendEntry({
    debitWalletId: input.fromWalletId,
    creditWalletId: input.toWalletId,
    amountTOUP: input.amountTOUP,
    pegSnapshotARS: input.pegSnapshotARS,
    reason: input.reason,
    ...(input.refType !== undefined ? { refType: input.refType } : {}),
    ...(input.refId !== undefined ? { refId: input.refId } : {}),
    pending: input.pending ?? false,
  });

  if (!entry.pending) {
    await store.updateBalance(input.fromWalletId, -input.amountTOUP);
    await store.updateBalance(input.toWalletId, input.amountTOUP);
  }
  return entry;
}

export interface MintInput {
  systemReserveWalletId: string;
  toWalletId: string;
  amountTOUP: number;
  pegSnapshotARS: number;
  /** Rollos físicos Trefilcon que respaldan la emisión. */
  rollosRespaldo: number;
  refId?: string;
}

/**
 * Mint: emite TOUP contra reserva física. Requiere que el respaldo cubra el monto
 * al peg vigente. La wallet SYSTEM_RESERVE acumula saldo negativo = total emitido.
 */
export async function mint(store: LedgerStore, input: MintInput): Promise<LedgerEntry> {
  const respaldoARS = input.rollosRespaldo * input.pegSnapshotARS;
  const emisionARS = input.amountTOUP * input.pegSnapshotARS;
  if (respaldoARS < emisionARS) {
    throw new LedgerError(
      `Respaldo insuficiente: ${respaldoARS} ARS < emisión ${emisionARS} ARS`,
      "INSUFFICIENT_RESERVE",
    );
  }
  return transfer(store, {
    fromWalletId: input.systemReserveWalletId,
    toWalletId: input.toWalletId,
    amountTOUP: input.amountTOUP,
    pegSnapshotARS: input.pegSnapshotARS,
    reason: "MINT",
    refType: "ToupReserve",
    ...(input.refId !== undefined ? { refId: input.refId } : {}),
    allowNegativeFrom: true,
  });
}

export interface BurnInput {
  systemReserveWalletId: string;
  fromWalletId: string;
  amountTOUP: number;
  pegSnapshotARS: number;
  refId?: string;
}

export async function burn(store: LedgerStore, input: BurnInput): Promise<LedgerEntry> {
  return transfer(store, {
    fromWalletId: input.fromWalletId,
    toWalletId: input.systemReserveWalletId,
    amountTOUP: input.amountTOUP,
    pegSnapshotARS: input.pegSnapshotARS,
    reason: "BURN",
    refType: "ToupReserve",
    ...(input.refId !== undefined ? { refId: input.refId } : {}),
  });
}

/**
 * Invariantes del ledger:
 *   1) sumaWallets() === 0 (double-entry: cada mint debita reserve y acredita user)
 *   2) totalEmitido = -reserveWallet.balance (cuanto debe la reserva al sistema)
 *   3) totalEmitido (TOUP) ≤ reservaTotalRollos() (no se sobre-emite)
 */
export async function validateInvariants(store: LedgerStore): Promise<{
  ok: boolean;
  sumaWallets: number;
  totalEmitido: number;
  reservaRollos: number;
  problemas: string[];
}> {
  const problemas: string[] = [];
  const sumaWallets = await store.sumaWallets();
  const totalEmitido = await store.totalEmitido();
  const reservaRollos = await store.reservaTotalRollos();

  if (Math.abs(sumaWallets) > 1e-6) {
    problemas.push(`Suma de wallets ≠ 0: ${sumaWallets}`);
  }
  if (totalEmitido > reservaRollos + 1e-6) {
    problemas.push(`Sobreemisión: ${totalEmitido} TOUP > ${reservaRollos} rollos respaldados`);
  }
  return { ok: problemas.length === 0, sumaWallets, totalEmitido, reservaRollos, problemas };
}
