import { describe, expect, it } from "vitest";
import {
  arsToTOUP,
  arsToUSD,
  getPegTOUP,
  PegMissingError,
  toupToARS,
  toupToUSD,
} from "./peg.js";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("peg Trefilcon", () => {
  it("devuelve el precio más reciente con fecha ≤ refDate", () => {
    const serie = [
      { fecha: d("2026-04-01"), precioARS: 60000 },
      { fecha: d("2026-05-01"), precioARS: 65000 },
      { fecha: d("2026-06-01"), precioARS: 70000 },
    ];
    const r = getPegTOUP(serie, d("2026-05-15"));
    expect(r.precioARS).toBe(65000);
    expect(r.stale).toBe(false);
  });

  it("marca stale si el precio es muy viejo", () => {
    const serie = [{ fecha: d("2025-01-01"), precioARS: 30000 }];
    const r = getPegTOUP(serie, d("2026-05-15"), 14);
    expect(r.stale).toBe(true);
    expect(r.diasAntiguedad).toBeGreaterThan(14);
  });

  it("tira PegMissingError si no hay datos", () => {
    expect(() => getPegTOUP([], d("2026-05-15"))).toThrow(PegMissingError);
  });

  it("ignora precios futuros respecto a refDate", () => {
    const serie = [
      { fecha: d("2026-01-01"), precioARS: 50000 },
      { fecha: d("2026-12-01"), precioARS: 90000 },
    ];
    const r = getPegTOUP(serie, d("2026-05-15"));
    expect(r.precioARS).toBe(50000);
  });
});

describe("conversiones", () => {
  it("arsToTOUP / toupToARS son inversas", () => {
    const peg = 65000;
    const ars = 1_300_000;
    const toup = arsToTOUP(ars, peg);
    expect(toup).toBe(20);
    expect(toupToARS(toup, peg)).toBe(ars);
  });

  it("toupToUSD usa peg ARS y luego USD/ARS", () => {
    expect(toupToUSD(10, 65000, 1000)).toBe(650);
  });

  it("arsToUSD básico", () => {
    expect(arsToUSD(1_000_000, 1000)).toBe(1000);
  });

  it("rechaza pegs no positivos", () => {
    expect(() => arsToTOUP(1000, 0)).toThrow();
    expect(() => toupToARS(1, -1)).toThrow();
    expect(() => toupToUSD(1, 1, 0)).toThrow();
  });
});
