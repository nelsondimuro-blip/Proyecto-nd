export type EmpresaCode =
  | "TN_SERVICIOS"
  | "TN_CONSTRUCTORA"
  | "TN_MATERIALES"
  | "TN_INMOBILIARIA"
  | "TN_ADMINISTRACION";

export type SubUnidadCode =
  | "ARQUITECTURA"
  | "INGENIERIA"
  | "MANTENIMIENTO"
  | "ELECTRICOS"
  | "SANITARIOS"
  | "ARIDOS"
  | "CONSORCIOS"
  | "VENTA_ALQUILER"
  | "OBRA";

export type TerminacionNivel = "basico" | "medio" | "premium";

export type ObraTipo = "casa" | "departamento" | "refaccion" | "ampliacion";

export interface ObraInput {
  tipo: ObraTipo;
  m2: number;
  ubicacion: string;
  terminaciones: TerminacionNivel;
  banos: number;
  cochera: boolean;
  tieneTerreno: boolean;
  notas?: string;
}

export interface QuoteLine {
  rubro: string;
  subUnidad: SubUnidadCode;
  empresaProveedora: EmpresaCode | "EXTERNO";
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitarioARS: number;
  subtotalARS: number;
  benchmarkExternoARS: number;
}

export interface QuoteTotals {
  totalARS: number;
  totalUSD: number;
  totalTOUP: number;
  pegTOUP_ARS: number;
  usdARS: number;
  benchmarkTotalARS: number;
  ahorroARS: number;
  ahorroPct: number;
}

export interface QuoteBreakdown {
  input: ObraInput;
  lines: QuoteLine[];
  porEmpresa: Record<EmpresaCode | "EXTERNO", number>;
  totals: QuoteTotals;
  confianza: number;
  generatedAt: string;
}

export interface WalletBalance {
  walletId: string;
  amountTOUP: number;
  valorARS: number;
  valorUSD: number;
  pegFecha: string;
  pegPrecioARS: number;
}

export type LedgerReason =
  | "MINT"
  | "BURN"
  | "BUY_INTENT"
  | "TRANSFER"
  | "RESERVA_PROPIEDAD"
  | "PAGO_OBRA"
  | "LIQUIDACION_INTERNA"
  | "CASHBACK";
