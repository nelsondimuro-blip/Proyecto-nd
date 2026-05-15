import { NextResponse } from "next/server";
import { prisma } from "@tn/db";
import { quote, type Catalog } from "@tn/pricing";
import { intake, matchPropiedades, type PropiedadCandidate } from "@tn/ai";
import { getPegTOUP } from "@tn/toup";
import type { EmpresaCode, SubUnidadCode } from "@tn/shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { descripcion?: string };
  if (!body.descripcion || body.descripcion.trim().length < 5) {
    return NextResponse.json({ error: "Descripción muy corta" }, { status: 400 });
  }

  // 1) IA intake → ObraInput estructurado.
  const obra = await intake(body.descripcion);

  // 2) Cargar catálogo desde DB.
  const [materiales, servicios, trefilcon, usdSerie, propiedades] = await Promise.all([
    prisma.material.findMany({ include: { empresa: true, subUnidad: true } }),
    prisma.servicio.findMany({ include: { empresa: true, subUnidad: true } }),
    prisma.trefilconPriceQuote.findMany({ orderBy: { fecha: "desc" }, take: 60 }),
    prisma.priceIndex.findMany({ orderBy: { fecha: "desc" }, take: 60 }),
    prisma.propiedad.findMany({ where: { disponible: true }, take: 50 }),
  ]);

  const catalog: Catalog = {
    materiales: materiales.map((m) => ({
      sku: m.sku,
      nombre: m.nombre,
      ...(m.marca ? { marca: m.marca } : {}),
      empresa: m.empresa.code as EmpresaCode,
      subUnidad: m.subUnidad.code as SubUnidadCode,
      unidad: m.unidad,
      precioARS: Number(m.precioARS),
      benchmarkARS: Number(m.benchmarkARS),
      stock: Number(m.stock),
    })),
    servicios: servicios.map((s) => ({
      codigo: s.codigo,
      nombre: s.nombre,
      empresa: s.empresa.code as EmpresaCode,
      subUnidad: s.subUnidad.code as SubUnidadCode,
      unidad: s.unidad,
      rendimientoM2: Number(s.rendimientoM2),
      precioUnitARS: Number(s.precioUnitARS),
      benchmarkARS: Number(s.benchmarkARS),
    })),
  };

  // 3) Peg vigente y USD.
  const refDate = new Date();
  const peg = getPegTOUP(
    trefilcon.map((t) => ({ fecha: t.fecha, precioARS: Number(t.precioARS) })),
    refDate,
  );
  const usdARS = usdSerie[0] ? Number(usdSerie[0].usdARS) : 1000;

  // 4) Cotización determinística.
  const q = quote(obra, catalog, { pegARS: peg.precioARS, usdARS, preferirGrupo: true });

  // 5) Match inmobiliario si no tiene terreno.
  const cartera: PropiedadCandidate[] = propiedades.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    modalidad: p.modalidad,
    m2: Number(p.m2),
    ubicacion: p.ubicacion,
    precioARS: Number(p.precioARS),
    ...(p.precioUSD ? { precioUSD: Number(p.precioUSD) } : {}),
    ...(p.descripcion ? { descripcion: p.descripcion } : {}),
  }));
  const matches = matchPropiedades(obra, cartera);

  return NextResponse.json({
    quote: q,
    propiedades: matches,
    pegInfo: { ...peg, fuente: trefilcon[0]?.fuente ?? "n/a" },
  });
}
