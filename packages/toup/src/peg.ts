/**
 * Peg de TN TOUP.
 *
 * 1 TOUP = precio de mercado de 1 rollo de cable Trefilcon 1×2,5 mm² × 100 m.
 *
 * El peg se materializa con `TrefilconPriceQuote(fecha, precioARS)` cargado en DB.
 * Este módulo es puro (no toca IO): recibe la serie y la fecha de referencia y
 * devuelve el precio vigente. La capa de DB hace el lookup.
 */

export interface TrefilconQuotePoint {
  fecha: Date;
  precioARS: number;
}

export interface UsdQuotePoint {
  fecha: Date;
  usdARS: number;
}

export class PegStaleError extends Error {
  constructor(public daysOld: number) {
    super(`Peg Trefilcon desactualizado (${daysOld} días).`);
    this.name = "PegStaleError";
  }
}

export class PegMissingError extends Error {
  constructor() {
    super("No hay precios Trefilcon cargados para definir el peg.");
    this.name = "PegMissingError";
  }
}

/**
 * Devuelve el último precio Trefilcon con fecha ≤ refDate.
 * Si el más reciente es más viejo que `staleAfterDays`, marca staleness en el resultado.
 */
export function getPegTOUP(
  serie: TrefilconQuotePoint[],
  refDate: Date,
  staleAfterDays = 14,
): { precioARS: number; fecha: Date; stale: boolean; diasAntiguedad: number } {
  if (serie.length === 0) throw new PegMissingError();

  const elegibles = serie
    .filter((p) => p.fecha.getTime() <= refDate.getTime())
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const ultimo = elegibles[0];
  if (!ultimo) throw new PegMissingError();

  const diasAntiguedad = Math.floor(
    (refDate.getTime() - ultimo.fecha.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    precioARS: ultimo.precioARS,
    fecha: ultimo.fecha,
    stale: diasAntiguedad > staleAfterDays,
    diasAntiguedad,
  };
}

export function arsToTOUP(amountARS: number, pegARS: number): number {
  if (pegARS <= 0) throw new Error("Peg ARS debe ser positivo");
  return amountARS / pegARS;
}

export function toupToARS(amountTOUP: number, pegARS: number): number {
  if (pegARS <= 0) throw new Error("Peg ARS debe ser positivo");
  return amountTOUP * pegARS;
}

export function toupToUSD(amountTOUP: number, pegARS: number, usdARS: number): number {
  if (usdARS <= 0) throw new Error("USD/ARS debe ser positivo");
  return toupToARS(amountTOUP, pegARS) / usdARS;
}

export function arsToUSD(amountARS: number, usdARS: number): number {
  if (usdARS <= 0) throw new Error("USD/ARS debe ser positivo");
  return amountARS / usdARS;
}
