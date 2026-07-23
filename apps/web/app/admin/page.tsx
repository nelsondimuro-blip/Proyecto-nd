import { prisma } from "@tn/db";

function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [empresas, materiales, servicios, propiedades, trefilconLast, wallets] = await Promise.all(
    [
      prisma.empresa.findMany({ orderBy: { code: "asc" } }),
      prisma.material.count(),
      prisma.servicio.count(),
      prisma.propiedad.count(),
      prisma.trefilconPriceQuote.findFirst({ orderBy: { fecha: "desc" } }),
      prisma.wallet.findMany({ include: { empresa: true } }),
    ],
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-tn-dark">Back-office Grupo TN</h1>
      <p className="text-slate-600 text-sm">
        Vista resumen. Las rutas de edición (catálogo, peg, ledger) se construyen en el módulo
        siguiente del MVP.
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Empresas" value={empresas.length} />
        <Stat label="Materiales" value={materiales} />
        <Stat label="Servicios" value={servicios} />
        <Stat label="Propiedades" value={propiedades} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-tn-dark">Empresas del grupo</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="border-b border-slate-200 text-left">
            <tr>
              <th className="py-2">Código</th>
              <th>Razón social</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="py-2 font-mono text-xs">{e.code}</td>
                <td>{e.razonSocial}</td>
                <td>{e.tipo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-tn-dark">Peg TN TOUP</h2>
        {trefilconLast ? (
          <p className="mt-2 text-slate-700">
            Último precio cargado: <strong>{fmtARS(Number(trefilconLast.precioARS))}</strong> el{" "}
            {trefilconLast.fecha.toISOString().slice(0, 10)} (fuente: {trefilconLast.fuente})
          </p>
        ) : (
          <p className="mt-2 text-red-600">Sin precios cargados.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-tn-dark">Wallets del sistema</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="border-b border-slate-200 text-left">
            <tr>
              <th className="py-2">Etiqueta</th>
              <th>Tipo</th>
              <th>Empresa</th>
              <th className="text-right">Saldo TOUP</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id} className="border-b border-slate-100">
                <td className="py-2">{w.label}</td>
                <td className="text-xs">{w.ownerType}</td>
                <td className="text-xs">{w.empresa?.code ?? "—"}</td>
                <td className="text-right font-mono">{Number(w.balanceTOUP).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-tn">{value}</p>
    </div>
  );
}
