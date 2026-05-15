"use client";

import { useState } from "react";
import type { QuoteBreakdown } from "@tn/shared";

const EJEMPLO =
  "Quiero construir una casa de 90 m² en Mar del Plata, terminación media, 2 baños y cochera. Todavía no tengo terreno.";

interface CotizarResponse {
  quote: QuoteBreakdown;
  propiedades?: Array<{
    id: string;
    tipo: string;
    modalidad: string;
    m2: number;
    ubicacion: string;
    precioARS: number;
    descripcion?: string;
    motivo?: string;
  }>;
}

function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function CotizarPage() {
  const [descripcion, setDescripcion] = useState(EJEMPLO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CotizarResponse | null>(null);
  const [pregunta, setPregunta] = useState("");
  const [advisorOut, setAdvisorOut] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);

  async function cotizar() {
    setLoading(true);
    setError(null);
    setData(null);
    setAdvisorOut("");
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion }),
      });
      if (!r.ok) throw new Error(await r.text());
      const json = (await r.json()) as CotizarResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function consultarAdvisor() {
    if (!data || !pregunta.trim()) return;
    setAdvisorLoading(true);
    setAdvisorOut("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: data.quote, question: pregunta }),
      });
      if (!r.ok || !r.body) throw new Error(await r.text());
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAdvisorOut((s) => s + decoder.decode(value));
      }
    } catch (e) {
      setAdvisorOut("Error: " + (e instanceof Error ? e.message : "desconocido"));
    } finally {
      setAdvisorLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-tn-dark">Cotizá tu obra</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <label className="block text-sm font-semibold text-slate-700">
          Describí tu obra en lenguaje natural
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-md border border-slate-300 p-3 text-sm"
        />
        <button
          onClick={cotizar}
          disabled={loading}
          className="mt-3 rounded-md bg-tn px-5 py-2 font-semibold text-white hover:bg-tn-dark disabled:opacity-50"
        >
          {loading ? "Cotizando…" : "Cotizar"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {data && (
        <div className="space-y-6">
          <div className="rounded-lg bg-tn p-6 text-white">
            <h2 className="text-xl font-semibold">Resumen</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Big label="Total" value={fmtARS(data.quote.totals.totalARS)} />
              <Big label="USD" value={fmtUSD(data.quote.totals.totalUSD)} />
              <Big label="TN TOUP" value={data.quote.totals.totalTOUP.toFixed(2)} />
            </div>
            <p className="mt-3 text-sm text-slate-100">
              Ahorro estimado vs. mercado: <strong>{fmtARS(data.quote.totals.ahorroARS)}</strong>{" "}
              ({data.quote.totals.ahorroPct.toFixed(1)}%). Peg TOUP: {fmtARS(data.quote.totals.pegTOUP_ARS)} / rollo Trefilcon.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-tn-dark">Desglose</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left">
                  <tr>
                    <th className="py-2">Rubro</th>
                    <th>Empresa</th>
                    <th>Cantidad</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quote.lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{l.rubro}</td>
                      <td>
                        <span className="rounded bg-tn-muted px-2 py-0.5 text-xs text-tn-dark">
                          {l.empresaProveedora}
                        </span>
                      </td>
                      <td>
                        {l.cantidad} {l.unidad}
                      </td>
                      <td className="text-right font-mono">{fmtARS(l.subtotalARS)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.propiedades && data.propiedades.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-tn-dark">
                Propiedades sugeridas (TN Inmobiliaria)
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {data.propiedades.map((p) => (
                  <div key={p.id} className="rounded border border-slate-200 p-4">
                    <p className="font-semibold">
                      {p.tipo} de {p.m2} m² — {p.ubicacion}
                    </p>
                    <p className="text-sm text-slate-600">{p.descripcion}</p>
                    <p className="mt-2 font-mono text-tn">{fmtARS(p.precioARS)}</p>
                    {p.motivo && <p className="mt-1 text-xs text-slate-500">{p.motivo}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-tn-dark">Asesor IA</h2>
            <p className="text-sm text-slate-600">
              Preguntá sobre el presupuesto: cómo ahorrar, qué diferir, qué etapas priorizar.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder="¿Cómo puedo bajar un 20% el costo?"
                className="flex-1 rounded-md border border-slate-300 p-2 text-sm"
              />
              <button
                onClick={consultarAdvisor}
                disabled={advisorLoading}
                className="rounded-md bg-tn-accent px-4 py-2 font-semibold text-tn-dark hover:bg-yellow-400 disabled:opacity-50"
              >
                {advisorLoading ? "…" : "Preguntar"}
              </button>
            </div>
            {advisorOut && (
              <div className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-800">
                {advisorOut}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-tn-dark p-4">
      <p className="text-xs uppercase tracking-wider text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
