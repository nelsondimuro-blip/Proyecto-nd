import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-tn p-10 text-white shadow-lg">
        <h1 className="text-4xl font-bold leading-tight">
          Del terreno a la llave,
          <br />
          pagá en <span className="text-tn-accent">TN TOUP</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-100">
          La fintech del metro cuadrado del Grupo TN. Cotización integral con IA,
          respaldada por nuestra cadena de proveedores y servicios propios.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/cotizar"
            className="rounded-md bg-tn-accent px-5 py-3 font-semibold text-tn-dark hover:bg-yellow-400"
          >
            Cotizá tu obra
          </Link>
          <Link
            href="/propiedades"
            className="rounded-md border border-white px-5 py-3 font-semibold text-white hover:bg-white hover:text-tn"
          >
            Ver propiedades
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-tn-dark">Toda la cadena, un solo grupo</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              title: "TN Servicios",
              desc: "Arquitectura, Ingeniería, Mantenimiento.",
            },
            {
              title: "TN Constructora",
              desc: "Ejecución de obra, cuadrillas y dirección.",
            },
            {
              title: "TN Materiales",
              desc: "Eléctricos, Sanitarios y Áridos. Distribuidor Trefilcon.",
            },
            {
              title: "TN Inmobiliaria",
              desc: "Consorcios, venta y alquiler de propiedades.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-tn">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-tn-accent bg-tn-muted p-8">
        <h2 className="text-2xl font-bold text-tn-dark">¿Qué es TN TOUP?</h2>
        <p className="mt-3 text-slate-700">
          1 TOUP = precio de mercado de 1 rollo de cable <strong>Trefilcon 1×2,5 mm² × 100 m</strong>.
          TN Materiales distribuye y respalda físicamente cada TOUP emitido. Sostener TOUP
          es sostener metros cuadrados futuros: cobertura natural contra la inflación de
          costos de construcción.
        </p>
      </section>
    </div>
  );
}
