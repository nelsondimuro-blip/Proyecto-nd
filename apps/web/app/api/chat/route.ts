import { advisorStream } from "@tn/ai";
import type { QuoteBreakdown } from "@tn/shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    quote: QuoteBreakdown;
    question: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  if (!body.quote || !body.question) {
    return new Response("Falta quote o question", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of advisorStream({
          quote: body.quote,
          question: body.question,
          ...(body.history ? { history: body.history } : {}),
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode("\n\n[error] " + (e instanceof Error ? e.message : String(e))),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
