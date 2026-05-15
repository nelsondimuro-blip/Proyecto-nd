import type { QuoteBreakdown } from "@tn/shared";
import { getAnthropic, MODELS } from "./client.js";
import { SYSTEM_GROUP_CONTEXT } from "./prompts.js";

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdvisorParams {
  quote: QuoteBreakdown;
  question: string;
  history?: AdvisorMessage[];
}

function quoteSummary(q: QuoteBreakdown): string {
  const lines = q.lines
    .map(
      (l) =>
        `  - ${l.rubro} [${l.empresaProveedora}]: ${l.cantidad} ${l.unidad} × $${l.precioUnitarioARS} = $${l.subtotalARS}`,
    )
    .join("\n");
  return `OBRA: ${q.input.tipo} de ${q.input.m2} m² en ${q.input.ubicacion}, terminación ${q.input.terminaciones}, ${q.input.banos} baño(s)${q.input.cochera ? ", cochera" : ""}${q.input.tieneTerreno ? "" : ", sin terreno"}.

LÍNEAS DEL BREAKDOWN:
${lines}

POR EMPRESA (ARS):
${Object.entries(q.porEmpresa)
  .filter(([, v]) => v > 0)
  .map(([e, v]) => `  - ${e}: $${v.toFixed(0)}`)
  .join("\n")}

TOTALES:
  - ARS: $${q.totals.totalARS}
  - USD: U$D ${q.totals.totalUSD}
  - TOUP: ${q.totals.totalTOUP} (peg: $${q.totals.pegTOUP_ARS} ARS/TOUP, USD: $${q.totals.usdARS} ARS)
  - Benchmark mercado: $${q.totals.benchmarkTotalARS}
  - Ahorro estimado: $${q.totals.ahorroARS} (${q.totals.ahorroPct}%)
  - Confianza: ${(q.confianza * 100).toFixed(0)}%`;
}

/**
 * Stream del advisor — devuelve un AsyncIterable<string> con chunks de texto.
 */
export async function* advisorStream(params: AdvisorParams): AsyncGenerator<string> {
  const anthropic = getAnthropic();
  const summary = quoteSummary(params.quote);

  const stream = anthropic.messages.stream({
    model: MODELS.advisor,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_GROUP_CONTEXT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `BREAKDOWN VIGENTE:\n${summary}`,
      },
    ],
    messages: [
      ...(params.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: params.question },
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function advisorOnce(params: AdvisorParams): Promise<string> {
  let full = "";
  for await (const chunk of advisorStream(params)) full += chunk;
  return full;
}
