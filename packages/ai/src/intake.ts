import { ObraInputSchema, type ObraInput } from "@tn/shared";
import { getAnthropic, MODELS } from "./client.js";

const INTAKE_SYSTEM = `Sos el módulo de intake del cotizador del Grupo TN. Tu único trabajo es extraer parámetros estructurados de la descripción libre del cliente y devolverlos usando la tool "registrarObra".

Reglas:
- Si el cliente no especifica algo, usá un valor razonable: terminaciones "medio", baños 1 si no dice, cochera false si no dice, tieneTerreno false si no dice nada o si dice que está buscando lote.
- tipo "casa", "departamento", "refaccion", "ampliacion" según la descripción.
- m2 numérico estricto. Si menciona rangos ("80 a 100"), tomá el promedio.
- ubicacion: ciudad, barrio o zona en texto libre.
- notas: cualquier detalle relevante que no entre en los campos.`;

/**
 * Schema escrito a mano para evitar acoplamiento al output específico de
 * zodToJsonSchema. Debe mantenerse alineado con `ObraInputSchema` en @tn/shared.
 */
const OBRA_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    tipo: { type: "string", enum: ["casa", "departamento", "refaccion", "ampliacion"] },
    m2: { type: "number", minimum: 1, maximum: 10000 },
    ubicacion: { type: "string", minLength: 2, maxLength: 200 },
    terminaciones: { type: "string", enum: ["basico", "medio", "premium"] },
    banos: { type: "integer", minimum: 0, maximum: 20 },
    cochera: { type: "boolean" },
    tieneTerreno: { type: "boolean" },
    notas: { type: "string", maxLength: 2000 },
  },
  required: ["tipo", "m2", "ubicacion", "terminaciones", "banos", "cochera", "tieneTerreno"],
  additionalProperties: false,
};

export async function intake(descripcion: string): Promise<ObraInput> {
  const anthropic = getAnthropic();
  const resp = await anthropic.messages.create({
    model: MODELS.intake,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: INTAKE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "registrarObra",
        description: "Registra los parámetros estructurados de la obra del cliente.",
        input_schema: OBRA_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "registrarObra" },
    messages: [{ role: "user", content: descripcion }],
  });

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Intake no devolvió tool_use");
  }
  return ObraInputSchema.parse(toolUse.input);
}
