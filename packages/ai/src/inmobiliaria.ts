import type { ObraInput } from "@tn/shared";

export interface PropiedadCandidate {
  id: string;
  tipo: string;
  modalidad: string;
  m2: number;
  ubicacion: string;
  precioARS: number;
  precioUSD?: number;
  descripcion?: string;
}

export interface PropiedadMatch extends PropiedadCandidate {
  score: number;
  motivo: string;
}

/**
 * Matcher determinístico (no IA) — la IA solo se usa cuando el set de cartera
 * es muy grande o cuando el usuario pide criterios cualitativos. Para MVP, ranking
 * por: m² requerido + tipo + ubicación.
 */
export function matchPropiedades(
  obra: ObraInput,
  cartera: PropiedadCandidate[],
  topN = 5,
): PropiedadMatch[] {
  if (obra.tieneTerreno) return [];

  const target = obra.tipo === "refaccion" ? "casa" : "lote";
  const ubicacionLower = obra.ubicacion.toLowerCase();

  const scored = cartera
    .filter((p) => p.modalidad === "venta")
    .map<PropiedadMatch>((p) => {
      let score = 0;
      const motivos: string[] = [];

      if (p.tipo === target) {
        score += 50;
        motivos.push(`tipo "${target}" coincide`);
      }

      // Para lotes, m² razonable es 1.5-3x la superficie de obra deseada.
      const ratio = p.m2 / Math.max(obra.m2, 1);
      if (target === "lote" && ratio >= 1.2 && ratio <= 4) {
        score += 30;
        motivos.push(`tamaño adecuado (${p.m2} m²)`);
      } else if (target === "casa" && ratio >= 0.7 && ratio <= 1.5) {
        score += 30;
        motivos.push(`tamaño adecuado (${p.m2} m²)`);
      }

      if (p.ubicacion.toLowerCase().includes(ubicacionLower.split(",")[0]!.trim())) {
        score += 20;
        motivos.push("ubicación coincide");
      }

      return { ...p, score, motivo: motivos.join("; ") };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}
