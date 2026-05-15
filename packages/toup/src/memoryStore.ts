import type { LedgerEntry, LedgerStore, WalletState } from "./ledger.js";

/** In-memory implementación de `LedgerStore` para tests y prototipos. */
export class MemoryLedgerStore implements LedgerStore {
  private wallets = new Map<string, WalletState>();
  private entries: LedgerEntry[] = [];
  private reservaRollos = 0;
  private pegARS = 0;
  private nextId = 1;

  constructor(opts: { pegARS: number }) {
    this.pegARS = opts.pegARS;
  }

  addWallet(id: string, balance = 0) {
    this.wallets.set(id, { id, balanceTOUP: balance });
  }

  addReservaRollos(rollos: number) {
    this.reservaRollos += rollos;
  }

  setPegARS(p: number) {
    this.pegARS = p;
  }

  async getWallet(id: string): Promise<WalletState | null> {
    return this.wallets.get(id) ?? null;
  }

  async updateBalance(id: string, delta: number): Promise<void> {
    const w = this.wallets.get(id);
    if (!w) throw new Error(`Wallet ${id} no existe`);
    w.balanceTOUP += delta;
  }

  async appendEntry(entry: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry> {
    const full: LedgerEntry = {
      ...entry,
      id: `entry_${this.nextId++}`,
      createdAt: new Date(),
    };
    this.entries.push(full);
    return full;
  }

  async totalEmitido(): Promise<number> {
    return this.entries
      .filter((e) => e.reason === "MINT" && !e.pending)
      .reduce((sum, e) => sum + e.amountTOUP, 0) -
      this.entries
        .filter((e) => e.reason === "BURN" && !e.pending)
        .reduce((sum, e) => sum + e.amountTOUP, 0);
  }

  async sumaWallets(): Promise<number> {
    let s = 0;
    for (const w of this.wallets.values()) s += w.balanceTOUP;
    return s;
  }

  async reservaTotalRollos(): Promise<number> {
    return this.reservaRollos;
  }

  async pegPrecioVigenteARS(): Promise<number> {
    return this.pegARS;
  }

  getEntries(): readonly LedgerEntry[] {
    return this.entries;
  }
}
