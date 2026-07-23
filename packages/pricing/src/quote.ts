import type {
  EmpresaCode,
  ObraInput,
  QuoteBreakdown,
  QuoteLine,
  SubUnidadCode,
} from "@tn/shared";
import { arsToTOUP, arsToUSD, toupToUSD } from "@tn/toup";
import type { Catalog, MaterialOffer, ServicioOffer } from "./catalog.js";
import { pickBestMaterial, pickBestServicio } from "./preferGroup.js";

export interface QuoteOptions {
  pegARS: number;
  usdARS: number;
  preferirGrupo?: boolean;
  toleranciaPct?: number;
}

interface RubroDemanda {
  rubro: string;
  subUnidad: SubUnidadCode;
  /** "material" o "servicio" */
  tipo: "material" | "servicio";
  /** SKU/código preferido si existe, si no se busca por subUnidad. */
  preferIds?: string[];
  cantidadPorM2: number;
  unidadFallback: string;
}

/**
 * Demanda base por m² según tipo de obra y nivel de terminación.
 * Estos son rendimientos típicos; se ajustan luego con datos reales del grupo.
 */
function demandaPorM2(input: ObraInput): RubroDemanda[] {
  const factorTerminacion =
    input.terminaciones === "premium" ? 1.4 : input.terminaciones === "medio" ? 1.0 : 0.75;

  const base: RubroDemanda[] = [
    // Servicios profesionales
    {
      rubro: "Proyecto de arquitectura",
      subUnidad: "ARQUITECTURA",
      tipo: "servicio",
      preferIds: ["ARQ-PROY"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    {
      rubro: "Cálculo estructural",
      subUnidad: "INGENIERIA",
      tipo: "servicio",
      preferIds: ["ING-CALC"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    // Obra
    {
      rubro: "Mampostería",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-MAMP"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    {
      rubro: "Contrapiso y carpeta",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-CONTR"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    {
      rubro: "Instalación eléctrica (mano de obra)",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-INST-ELEC"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    {
      rubro: "Instalación sanitaria (mano de obra)",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-INST-SAN"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    {
      rubro: "Terminaciones",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-TERM"],
      cantidadPorM2: factorTerminacion,
      unidadFallback: "m2",
    },
    {
      rubro: "Dirección de obra",
      subUnidad: "OBRA",
      tipo: "servicio",
      preferIds: ["OBRA-DIR"],
      cantidadPorM2: 1,
      unidadFallback: "m2",
    },
    // Materiales — eléctricos
    {
      rubro: "Cable eléctrico (rollos)",
      subUnidad: "ELECTRICOS",
      tipo: "material",
      preferIds: ["CABLE-TREFILCON-1X2.5"],
      cantidadPorM2: 0.08, // ≈ 1 rollo 100m cada 12,5 m²
      unidadFallback: "rollo",
    },
    {
      rubro: "Tablero principal",
      subUnidad: "ELECTRICOS",
      tipo: "material",
      preferIds: ["TABLERO-12P"],
      cantidadPorM2: 1 / 80, // 1 tablero por casa de ~80 m²
      unidadFallback: "u",
    },
    // Materiales — sanitarios (escala con baños)
    {
      rubro: "Inodoros",
      subUnidad: "SANITARIOS",
      tipo: "material",
      preferIds: ["INODORO-LOZA"],
      cantidadPorM2: input.banos / Math.max(input.m2, 1),
      unidadFallback: "u",
    },
    {
      rubro: "Griferías",
      subUnidad: "SANITARIOS",
      tipo: "material",
      preferIds: ["GRIFERIA-MONO"],
      cantidadPorM2: (input.banos * 2) / Math.max(input.m2, 1),
      unidadFallback: "u",
    },
    {
      rubro: "Caños PPN",
      subUnidad: "SANITARIOS",
      tipo: "material",
      preferIds: ["CANO-PPN-32"],
      cantidadPorM2: 0.15,
      unidadFallback: "u",
    },
    // Materiales — áridos
    {
      rubro: "Cemento",
      subUnidad: "ARIDOS",
      tipo: "material",
      preferIds: ["CEMENTO-50KG"],
      cantidadPorM2: 1.2,
      unidadFallback: "bolsa",
    },
    {
      rubro: "Arena gruesa",
      subUnidad: "ARIDOS",
      tipo: "material",
      preferIds: ["ARENA-GRUESA-M3"],
      cantidadPorM2: 0.08,
      unidadFallback: "m3",
    },
    {
      rubro: "Ladrillos huecos",
      subUnidad: "ARIDOS",
      tipo: "material",
      preferIds: ["LADRILLO-HUECO-18"],
      cantidadPorM2: 22,
      unidadFallback: "u",
    },
  ];

  // En refacciones, no se replantea arquitectura ni cálculo desde cero.
  if (input.tipo === "refaccion") {
    return base.filter(
      (r) => r.rubro !== "Proyecto de arquitectura" && r.rubro !== "Cálculo estructural",
    );
  }
  return base;
}

function resolveMaterial(
  catalog: Catalog,
  demanda: RubroDemanda,
  opts: { toleranciaPct: number },
): MaterialOffer | null {
  const candidatos = catalog.materiales.filter((m) => {
    if (demanda.preferIds && demanda.preferIds.includes(m.sku)) return true;
    return m.subUnidad === demanda.subUnidad;
  });
  return pickBestMaterial(candidatos, opts);
}

function resolveServicio(
  catalog: Catalog,
  demanda: RubroDemanda,
  opts: { toleranciaPct: number },
): ServicioOffer | null {
  const candidatos = catalog.servicios.filter((s) => {
    if (demanda.preferIds && demanda.preferIds.includes(s.codigo)) return true;
    return s.subUnidad === demanda.subUnidad;
  });
  return pickBestServicio(candidatos, opts);
}

export function quote(input: ObraInput, catalog: Catalog, options: QuoteOptions): QuoteBreakdown {
  const preferirGrupo = options.preferirGrupo ?? true;
  const toleranciaPct = options.toleranciaPct ?? 5;
  const demandas = demandaPorM2(input);

  const lines: QuoteLine[] = [];

  for (const d of demandas) {
    const cantidadAbs = Math.max(d.cantidadPorM2 * input.m2, 0);
    if (cantidadAbs <= 0) continue;

    if (d.tipo === "servicio") {
      const offer = resolveServicio(catalog, d, { toleranciaPct: preferirGrupo ? toleranciaPct : 0 });
      if (!offer) continue;
      const subtotal = offer.precioUnitARS * cantidadAbs;
      const benchmark = offer.benchmarkARS * cantidadAbs;
      lines.push({
        rubro: d.rubro,
        subUnidad: d.subUnidad,
        empresaProveedora: offer.empresa,
        descripcion: offer.nombre,
        unidad: offer.unidad,
        cantidad: round(cantidadAbs, 4),
        precioUnitarioARS: offer.precioUnitARS,
        subtotalARS: round(subtotal, 2),
        benchmarkExternoARS: round(benchmark, 2),
      });
    } else {
      const offer = resolveMaterial(catalog, d, { toleranciaPct: preferirGrupo ? toleranciaPct : 0 });
      if (!offer) continue;
      const subtotal = offer.precioARS * cantidadAbs;
      const benchmark = offer.benchmarkARS * cantidadAbs;
      lines.push({
        rubro: d.rubro,
        subUnidad: d.subUnidad,
        empresaProveedora: offer.empresa,
        descripcion: offer.nombre + (offer.marca ? ` (${offer.marca})` : ""),
        unidad: offer.unidad,
        cantidad: round(cantidadAbs, 4),
        precioUnitarioARS: offer.precioARS,
        subtotalARS: round(subtotal, 2),
        benchmarkExternoARS: round(benchmark, 2),
      });
    }
  }

  const totalARS = lines.reduce((sum, l) => sum + l.subtotalARS, 0);
  const benchmarkTotalARS = lines.reduce((sum, l) => sum + l.benchmarkExternoARS, 0);

  const porEmpresa: Record<EmpresaCode | "EXTERNO", number> = {
    TN_SERVICIOS: 0,
    TN_CONSTRUCTORA: 0,
    TN_MATERIALES: 0,
    TN_INMOBILIARIA: 0,
    TN_ADMINISTRACION: 0,
    EXTERNO: 0,
  };
  for (const l of lines) porEmpresa[l.empresaProveedora] += l.subtotalARS;

  const totalTOUP = arsToTOUP(totalARS, options.pegARS);
  const totalUSD = arsToUSD(totalARS, options.usdARS);
  const ahorroARS = benchmarkTotalARS - totalARS;
  const ahorroPct = benchmarkTotalARS > 0 ? (ahorroARS / benchmarkTotalARS) * 100 : 0;

  // Confianza heurística: m² razonable + suficientes rubros resueltos
  const confianza = clamp01(
    0.5 +
      (input.m2 >= 30 && input.m2 <= 500 ? 0.3 : 0) +
      (lines.length / demandas.length) * 0.2,
  );

  return {
    input,
    lines,
    porEmpresa,
    totals: {
      totalARS: round(totalARS, 2),
      totalUSD: round(totalUSD, 2),
      totalTOUP: round(totalTOUP, 4),
      pegTOUP_ARS: options.pegARS,
      usdARS: options.usdARS,
      benchmarkTotalARS: round(benchmarkTotalARS, 2),
      ahorroARS: round(ahorroARS, 2),
      ahorroPct: round(ahorroPct, 2),
    },
    confianza: round(confianza, 2),
    generatedAt: new Date().toISOString(),
  };
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Utilidad para que el advisor sepa traducir cualquier monto del breakdown.
export function montoEnTOUP(amountARS: number, pegARS: number): number {
  return arsToTOUP(amountARS, pegARS);
}

export function montoEnUSD(amountTOUP: number, pegARS: number, usdARS: number): number {
  return toupToUSD(amountTOUP, pegARS, usdARS);
}
