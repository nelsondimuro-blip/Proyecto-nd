import { prisma } from "@tn/db";
import { getPegTOUP } from "@tn/toup";

function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const [trefilcon, usdSerie] = await Promise.all([
    prisma.trefilconPriceQuote.findMany({ orderBy: { fecha: "desc" }, take: 30 }),
    prisma.priceIndex.findMany({ orderBy: { fecha: "desc" }, take: 1 }),
  ]);

  if (trefilcon.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-tn-dark">Wallet TN TOUP</h1>
        <p className="text-slate-600">No hay peg Trefilcon cargado. Avisar a TN Materiales.</p>
      </div>
    );
  }

  const refDate = new Date();
  const peg = getPegTOUP(
    trefilcon.map((t) => ({ fecha: t.fecha, precioARS: Number(t.precioARS) })),
    refDate,
  );
  const usdARS = usdSerie[0] ? Number(usdSerie[0].usdARS) : 1000;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-tn-dark">Wallet TN TOUP</h1>

      <div className="rounded-lg bg-tn p-6 text-white">
        <p className="text-xs uppercase tracking-wide text-slate-200">Peg vigente</p>
        <p className="mt-1 text-3xl font-bold">{fmtARS(peg.precioARS)} / TOUP</p>
        <p className="mt-1 text-sm text-slate-200">
          1 TOUP = 1 rollo de cable Trefilcon 1×2,5 mm² × 100 m.
        </p>
        <p className="mt-1 text-xs text-slate-300">
          Precio del {peg.fecha.toISOString().slice(0, 10)} ({peg.diasAntiguedad} días de antigüedad).
          USD/ARS oficial: {usdARS}.
        </p>
        {peg.stale && (
          <p className="mt-2 rounded bg-red-700 px-3 py-1 text-sm">
            ⚠ Peg desactualizado. Solicitar carga de precio al equipo TN Materiales.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-tn-dark">Tu wallet</h2>
        <p className="mt-2 text-slate-600">
          Iniciá sesión para ver tu saldo en TOUP. (El flujo de auth completo se habilita en el
          módulo siguiente del MVP.)
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-tn-dark">Historial del peg (últimos 30 registros)</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="border-b border-slate-200 text-left">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="text-right">Precio ARS</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
            {trefilcon.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="py-2">{t.fecha.toISOString().slice(0, 10)}</td>
                <td className="text-right font-mono">{fmtARS(Number(t.precioARS))}</td>
                <td className="text-xs text-slate-500">{t.fuente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
