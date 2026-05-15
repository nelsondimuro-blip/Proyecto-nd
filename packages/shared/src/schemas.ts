import { z } from "zod";

export const TerminacionSchema = z.enum(["basico", "medio", "premium"]);
export const ObraTipoSchema = z.enum(["casa", "departamento", "refaccion", "ampliacion"]);

export const ObraInputSchema = z.object({
  tipo: ObraTipoSchema,
  m2: z.number().positive().max(10000),
  ubicacion: z.string().min(2).max(200),
  terminaciones: TerminacionSchema,
  banos: z.number().int().min(0).max(20),
  cochera: z.boolean(),
  tieneTerreno: z.boolean(),
  notas: z.string().max(2000).optional(),
});

export type ObraInputParsed = z.infer<typeof ObraInputSchema>;

export const EmpresaCodeSchema = z.enum([
  "TN_SERVICIOS",
  "TN_CONSTRUCTORA",
  "TN_MATERIALES",
  "TN_INMOBILIARIA",
  "TN_ADMINISTRACION",
]);

export const LedgerReasonSchema = z.enum([
  "MINT",
  "BURN",
  "BUY_INTENT",
  "TRANSFER",
  "RESERVA_PROPIEDAD",
  "PAGO_OBRA",
  "LIQUIDACION_INTERNA",
  "CASHBACK",
]);
