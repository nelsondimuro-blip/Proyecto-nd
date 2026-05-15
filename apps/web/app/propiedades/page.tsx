import { prisma } from "@tn/db";

function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export const dynamic = "force-dynamic";

export default async function PropiedadesPage() {
  const propiedades = await prisma.propiedad.findMany({
    where: { disponible: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-tn-dark">Propiedades — TN Inmobiliaria</h1>
      <p className="text-slate-600">
        Cartera disponible de TN Inmobiliaria S.A. Reservalo con TN TOUP.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {propiedades.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-tn">
              {p.tipo} — {p.modalidad}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-tn-dark">{p.ubicacion}</h3>
            <p className="mt-1 text-sm text-slate-600">{p.descripcion}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-mono text-tn">{fmtARS(Number(p.precioARS))}</p>
              {p.precioUSD && (
                <p className="text-sm text-slate-500">{fmtUSD(Number(p.precioUSD))}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">{Number(p.m2)} m²</p>
          </div>
        ))}
        {propiedades.length === 0 && (
          <p className="text-slate-500">No hay propiedades cargadas todavía.</p>
        )}
      </div>
    </div>
  );
}
