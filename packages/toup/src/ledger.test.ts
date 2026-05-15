import { beforeEach, describe, expect, it } from "vitest";
import { burn, LedgerError, mint, transfer, validateInvariants } from "./ledger.js";
import { MemoryLedgerStore } from "./memoryStore.js";

const PEG = 65000;
const SYSTEM = "wallet_system";
const ALICE = "wallet_alice";
const BOB = "wallet_bob";

function fresh(): MemoryLedgerStore {
  const s = new MemoryLedgerStore({ pegARS: PEG });
  s.addWallet(SYSTEM, 0);
  s.addWallet(ALICE, 0);
  s.addWallet(BOB, 0);
  s.addReservaRollos(100); // 100 rollos físicos en stock
  return s;
}

describe("mint", () => {
  let store: MemoryLedgerStore;
  beforeEach(() => {
    store = fresh();
  });

  it("emite TOUP a una wallet usuario y deja system con saldo negativo", async () => {
    await mint(store, {
      systemReserveWalletId: SYSTEM,
      toWalletId: ALICE,
      amountTOUP: 10,
      pegSnapshotARS: PEG,
      rollosRespaldo: 10,
    });
    expect((await store.getWallet(ALICE))?.balanceTOUP).toBe(10);
    expect((await store.getWallet(SYSTEM))?.balanceTOUP).toBe(-10);
  });

  it("rechaza emisión sin respaldo suficiente", async () => {
    await expect(
      mint(store, {
        systemReserveWalletId: SYSTEM,
        toWalletId: ALICE,
        amountTOUP: 50,
        pegSnapshotARS: PEG,
        rollosRespaldo: 10,
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });
});

describe("transfer", () => {
  let store: MemoryLedgerStore;
  beforeEach(async () => {
    store = fresh();
    await mint(store, {
      systemReserveWalletId: SYSTEM,
      toWalletId: ALICE,
      amountTOUP: 50,
      pegSnapshotARS: PEG,
      rollosRespaldo: 50,
    });
  });

  it("mueve TOUP de Alice a Bob", async () => {
    await transfer(store, {
      fromWalletId: ALICE,
      toWalletId: BOB,
      amountTOUP: 20,
      pegSnapshotARS: PEG,
      reason: "TRANSFER",
    });
    expect((await store.getWallet(ALICE))?.balanceTOUP).toBe(30);
    expect((await store.getWallet(BOB))?.balanceTOUP).toBe(20);
  });

  it("rechaza saldo insuficiente", async () => {
    await expect(
      transfer(store, {
        fromWalletId: BOB,
        toWalletId: ALICE,
        amountTOUP: 5,
        pegSnapshotARS: PEG,
        reason: "TRANSFER",
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("rechaza monto no positivo", async () => {
    await expect(
      transfer(store, {
        fromWalletId: ALICE,
        toWalletId: BOB,
        amountTOUP: 0,
        pegSnapshotARS: PEG,
        reason: "TRANSFER",
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("rechaza misma wallet en ambos extremos", async () => {
    await expect(
      transfer(store, {
        fromWalletId: ALICE,
        toWalletId: ALICE,
        amountTOUP: 1,
        pegSnapshotARS: PEG,
        reason: "TRANSFER",
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("pending no actualiza saldos", async () => {
    await transfer(store, {
      fromWalletId: ALICE,
      toWalletId: BOB,
      amountTOUP: 10,
      pegSnapshotARS: PEG,
      reason: "BUY_INTENT",
      pending: true,
    });
    expect((await store.getWallet(ALICE))?.balanceTOUP).toBe(50);
    expect((await store.getWallet(BOB))?.balanceTOUP).toBe(0);
  });
});

describe("burn", () => {
  it("quema TOUP de una wallet y la regresa a reserve", async () => {
    const store = fresh();
    await mint(store, {
      systemReserveWalletId: SYSTEM,
      toWalletId: ALICE,
      amountTOUP: 30,
      pegSnapshotARS: PEG,
      rollosRespaldo: 30,
    });
    await burn(store, {
      systemReserveWalletId: SYSTEM,
      fromWalletId: ALICE,
      amountTOUP: 10,
      pegSnapshotARS: PEG,
    });
    expect((await store.getWallet(ALICE))?.balanceTOUP).toBe(20);
    expect((await store.getWallet(SYSTEM))?.balanceTOUP).toBe(-20);
  });
});

describe("invariantes", () => {
  it("ok tras mint + transfers", async () => {
    const store = fresh();
    await mint(store, {
      systemReserveWalletId: SYSTEM,
      toWalletId: ALICE,
      amountTOUP: 40,
      pegSnapshotARS: PEG,
      rollosRespaldo: 40,
    });
    await transfer(store, {
      fromWalletId: ALICE,
      toWalletId: BOB,
      amountTOUP: 15,
      pegSnapshotARS: PEG,
      reason: "TRANSFER",
    });
    const inv = await validateInvariants(store);
    expect(inv.ok).toBe(true);
    expect(inv.sumaWallets).toBeCloseTo(0, 6);
    expect(inv.totalEmitido).toBe(40);
  });

  it("ok tras mint + burn", async () => {
    const store = fresh();
    await mint(store, {
      systemReserveWalletId: SYSTEM,
      toWalletId: ALICE,
      amountTOUP: 25,
      pegSnapshotARS: PEG,
      rollosRespaldo: 25,
    });
    await burn(store, {
      systemReserveWalletId: SYSTEM,
      fromWalletId: ALICE,
      amountTOUP: 10,
      pegSnapshotARS: PEG,
    });
    const inv = await validateInvariants(store);
    expect(inv.ok).toBe(true);
    expect(inv.totalEmitido).toBe(15);
  });
});
