import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed Grupo TN…");

  // Empresas
  const [servicios, constructora, materiales, inmobiliaria, admin] = await Promise.all([
    prisma.empresa.upsert({
      where: { code: "TN_SERVICIOS" },
      update: {},
      create: { code: "TN_SERVICIOS", razonSocial: "TN Servicios S.R.L.", tipo: "SRL" },
    }),
    prisma.empresa.upsert({
      where: { code: "TN_CONSTRUCTORA" },
      update: {},
      create: { code: "TN_CONSTRUCTORA", razonSocial: "TN Constructora S.R.L.", tipo: "SRL" },
    }),
    prisma.empresa.upsert({
      where: { code: "TN_MATERIALES" },
      update: {},
      create: { code: "TN_MATERIALES", razonSocial: "TN Materiales S.R.L.", tipo: "SRL" },
    }),
    prisma.empresa.upsert({
      where: { code: "TN_INMOBILIARIA" },
      update: {},
      create: { code: "TN_INMOBILIARIA", razonSocial: "TN Inmobiliaria S.A.", tipo: "SA" },
    }),
    prisma.empresa.upsert({
      where: { code: "TN_ADMINISTRACION" },
      update: {},
      create: { code: "TN_ADMINISTRACION", razonSocial: "TN Administración", tipo: "ADMIN" },
    }),
  ]);

  // SubUnidades
  const sus = await Promise.all([
    upsertSubUnidad(servicios.id, "ARQUITECTURA", "Arquitectura"),
    upsertSubUnidad(servicios.id, "INGENIERIA", "Ingeniería"),
    upsertSubUnidad(servicios.id, "MANTENIMIENTO", "Mantenimiento"),
    upsertSubUnidad(materiales.id, "ELECTRICOS", "Eléctricos"),
    upsertSubUnidad(materiales.id, "SANITARIOS", "Sanitarios"),
    upsertSubUnidad(materiales.id, "ARIDOS", "Áridos"),
    upsertSubUnidad(constructora.id, "OBRA", "Obra"),
    upsertSubUnidad(inmobiliaria.id, "CONSORCIOS", "Consorcios"),
    upsertSubUnidad(inmobiliaria.id, "VENTA_ALQUILER", "Venta / Alquiler"),
  ]);

  const subByCode = Object.fromEntries(sus.map((s) => [s.code, s]));

  // Materiales (TN Materiales)
  const materialesSeed = [
    {
      sub: "ELECTRICOS",
      sku: "CABLE-TREFILCON-1X2.5",
      nombre: "Cable Trefilcon 1×2,5 mm² × 100 m",
      marca: "Trefilcon",
      unidad: "rollo",
      precio: 65000,
      bench: 72000,
      stock: 500,
    },
    {
      sub: "ELECTRICOS",
      sku: "CABLE-TREFILCON-1X4",
      nombre: "Cable Trefilcon 1×4 mm² × 100 m",
      marca: "Trefilcon",
      unidad: "rollo",
      precio: 95000,
      bench: 105000,
      stock: 300,
    },
    {
      sub: "ELECTRICOS",
      sku: "TABLERO-12P",
      nombre: "Tablero principal 12 polos",
      unidad: "u",
      precio: 48000,
      bench: 56000,
      stock: 80,
    },
    {
      sub: "SANITARIOS",
      sku: "INODORO-LOZA",
      nombre: "Inodoro de loza con depósito",
      unidad: "u",
      precio: 95000,
      bench: 115000,
      stock: 40,
    },
    {
      sub: "SANITARIOS",
      sku: "GRIFERIA-MONO",
      nombre: "Griferia monocomando lavatorio",
      unidad: "u",
      precio: 55000,
      bench: 68000,
      stock: 60,
    },
    {
      sub: "SANITARIOS",
      sku: "CANO-PPN-32",
      nombre: "Caño PPN 32 mm × 4 m",
      unidad: "u",
      precio: 4200,
      bench: 5200,
      stock: 500,
    },
    {
      sub: "ARIDOS",
      sku: "ARENA-GRUESA-M3",
      nombre: "Arena gruesa lavada",
      unidad: "m3",
      precio: 22000,
      bench: 26000,
      stock: 2000,
    },
    {
      sub: "ARIDOS",
      sku: "CEMENTO-50KG",
      nombre: "Cemento Portland 50 kg",
      unidad: "bolsa",
      precio: 8500,
      bench: 9800,
      stock: 5000,
    },
    {
      sub: "ARIDOS",
      sku: "LADRILLO-HUECO-18",
      nombre: "Ladrillo hueco 18 cm",
      unidad: "u",
      precio: 950,
      bench: 1150,
      stock: 30000,
    },
  ];

  for (const m of materialesSeed) {
    const sub = subByCode[m.sub];
    if (!sub) continue;
    await prisma.material.upsert({
      where: { empresaId_sku: { empresaId: materiales.id, sku: m.sku } },
      update: {
        precioARS: m.precio,
        benchmarkARS: m.bench,
        stock: m.stock,
      },
      create: {
        empresaId: materiales.id,
        subUnidadId: sub.id,
        sku: m.sku,
        nombre: m.nombre,
        marca: m.marca,
        unidad: m.unidad,
        precioARS: m.precio,
        benchmarkARS: m.bench,
        stock: m.stock,
      },
    });
  }

  // Servicios (TN Servicios + TN Constructora)
  const serviciosSeed = [
    {
      empresaId: servicios.id,
      sub: "ARQUITECTURA",
      codigo: "ARQ-PROY",
      nombre: "Proyecto de arquitectura",
      unidad: "m2",
      rend: 1,
      precio: 18000,
      bench: 24000,
    },
    {
      empresaId: servicios.id,
      sub: "INGENIERIA",
      codigo: "ING-CALC",
      nombre: "Cálculo estructural",
      unidad: "m2",
      rend: 1,
      precio: 12000,
      bench: 16000,
    },
    {
      empresaId: servicios.id,
      sub: "MANTENIMIENTO",
      codigo: "MANT-ANUAL",
      nombre: "Mantenimiento anual preventivo",
      unidad: "m2",
      rend: 1,
      precio: 4500,
      bench: 6000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-MAMP",
      nombre: "Mampostería completa",
      unidad: "m2",
      rend: 1,
      precio: 85000,
      bench: 105000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-CONTR",
      nombre: "Contrapiso y carpeta",
      unidad: "m2",
      rend: 1,
      precio: 22000,
      bench: 28000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-INST-ELEC",
      nombre: "Instalación eléctrica completa (mano de obra)",
      unidad: "m2",
      rend: 1,
      precio: 18000,
      bench: 24000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-INST-SAN",
      nombre: "Instalación sanitaria completa (mano de obra)",
      unidad: "m2",
      rend: 1,
      precio: 16000,
      bench: 21000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-TERM",
      nombre: "Terminaciones (revoque + pintura + pisos)",
      unidad: "m2",
      rend: 1,
      precio: 45000,
      bench: 58000,
    },
    {
      empresaId: constructora.id,
      sub: "OBRA",
      codigo: "OBRA-DIR",
      nombre: "Dirección de obra",
      unidad: "m2",
      rend: 1,
      precio: 9500,
      bench: 14000,
    },
  ];

  for (const s of serviciosSeed) {
    const sub = subByCode[s.sub];
    if (!sub) continue;
    await prisma.servicio.upsert({
      where: { empresaId_codigo: { empresaId: s.empresaId, codigo: s.codigo } },
      update: { precioUnitARS: s.precio, benchmarkARS: s.bench },
      create: {
        empresaId: s.empresaId,
        subUnidadId: sub.id,
        codigo: s.codigo,
        nombre: s.nombre,
        unidad: s.unidad,
        rendimientoM2: s.rend,
        precioUnitARS: s.precio,
        benchmarkARS: s.bench,
      },
    });
  }

  // Propiedades (TN Inmobiliaria)
  const propiedadesSeed = [
    {
      tipo: "lote",
      modalidad: "venta",
      m2: 300,
      ubicacion: "Mar del Plata, Sierra de los Padres",
      precioARS: 35_000_000,
      precioUSD: 35000,
      descripcion: "Lote 12×25 con servicios.",
    },
    {
      tipo: "casa",
      modalidad: "venta",
      m2: 110,
      ubicacion: "Mar del Plata, Constitución",
      precioARS: 145_000_000,
      precioUSD: 145000,
      descripcion: "Casa a refaccionar, 3 ambientes, patio.",
    },
    {
      tipo: "departamento",
      modalidad: "alquiler",
      m2: 55,
      ubicacion: "Mar del Plata, Centro",
      precioARS: 480_000,
      descripcion: "2 ambientes, balcón, amoblado.",
    },
  ];

  for (const p of propiedadesSeed) {
    const exists = await prisma.propiedad.findFirst({
      where: { empresaId: inmobiliaria.id, ubicacion: p.ubicacion, tipo: p.tipo },
    });
    if (!exists) {
      await prisma.propiedad.create({
        data: {
          empresaId: inmobiliaria.id,
          tipo: p.tipo,
          modalidad: p.modalidad,
          m2: p.m2,
          ubicacion: p.ubicacion,
          precioARS: p.precioARS,
          precioUSD: p.precioUSD,
          descripcion: p.descripcion,
        },
      });
    }
  }

  // Peg inicial Trefilcon
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  await prisma.trefilconPriceQuote.upsert({
    where: { fecha: hoy },
    update: { precioARS: 65000, fuente: "seed" },
    create: { fecha: hoy, precioARS: 65000, fuente: "seed", notas: "Peg inicial TN TOUP" },
  });

  // USD oficial
  await prisma.priceIndex.upsert({
    where: { fecha: hoy },
    update: { usdARS: 1000 },
    create: { fecha: hoy, usdARS: 1000, fuente: "seed" },
  });

  // Wallets de empresas
  for (const emp of [servicios, constructora, materiales, inmobiliaria, admin]) {
    await prisma.wallet.upsert({
      where: { empresaId: emp.id },
      update: {},
      create: {
        ownerType: "EMPRESA",
        empresaId: emp.id,
        label: `Wallet ${emp.code}`,
      },
    });
  }

  // Wallet del sistema de reserva (contraparte de mint/burn)
  const reserveWallet = await prisma.wallet.findFirst({
    where: { ownerType: "SYSTEM_RESERVE" },
  });
  if (!reserveWallet) {
    await prisma.wallet.create({
      data: {
        ownerType: "SYSTEM_RESERVE",
        label: "TN TOUP Reserve (Trefilcon)",
      },
    });
  }

  console.log("Seed completo.");
}

async function upsertSubUnidad(
  empresaId: string,
  code:
    | "ARQUITECTURA"
    | "INGENIERIA"
    | "MANTENIMIENTO"
    | "ELECTRICOS"
    | "SANITARIOS"
    | "ARIDOS"
    | "CONSORCIOS"
    | "VENTA_ALQUILER"
    | "OBRA",
  nombre: string,
) {
  return prisma.subUnidad.upsert({
    where: { empresaId_code: { empresaId, code } },
    update: { nombre },
    create: { empresaId, code, nombre },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
