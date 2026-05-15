import type { MaterialOffer, ServicioOffer } from "./catalog.js";

export interface PreferGroupOptions {
  /** Si el precio del grupo está dentro de este % por encima del externo, igual se elige. */
  toleranciaPct: number;
}

/**
 * Elige la mejor oferta priorizando empresas del grupo TN si están dentro de la
 * tolerancia. Si no, cae al benchmark externo.
 */
export function pickBestMaterial(
  candidatos: MaterialOffer[],
  opts: PreferGroupOptions = { toleranciaPct: 5 },
): MaterialOffer | null {
  if (candidatos.length === 0) return null;
  const grupo = candidatos.filter((c) => c.empresa !== "EXTERNO");
  const externo = candidatos.filter((c) => c.empresa === "EXTERNO");

  const bestGrupo = [...grupo].sort((a, b) => a.precioARS - b.precioARS)[0];
  const bestExterno = [...externo].sort((a, b) => a.precioARS - b.precioARS)[0];

  if (!bestGrupo) return bestExterno ?? null;
  if (!bestExterno) return bestGrupo;

  const umbral = bestExterno.precioARS * (1 + opts.toleranciaPct / 100);
  return bestGrupo.precioARS <= umbral ? bestGrupo : bestExterno;
}

export function pickBestServicio(
  candidatos: ServicioOffer[],
  opts: PreferGroupOptions = { toleranciaPct: 5 },
): ServicioOffer | null {
  if (candidatos.length === 0) return null;
  const grupo = candidatos.filter((c) => c.empresa !== "EXTERNO");
  const externo = candidatos.filter((c) => c.empresa === "EXTERNO");

  const bestGrupo = [...grupo].sort((a, b) => a.precioUnitARS - b.precioUnitARS)[0];
  const bestExterno = [...externo].sort((a, b) => a.precioUnitARS - b.precioUnitARS)[0];

  if (!bestGrupo) return bestExterno ?? null;
  if (!bestExterno) return bestGrupo;

  const umbral = bestExterno.precioUnitARS * (1 + opts.toleranciaPct / 100);
  return bestGrupo.precioUnitARS <= umbral ? bestGrupo : bestExterno;
}
