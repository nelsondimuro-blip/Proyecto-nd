import { describe, expect, it } from "vitest";
import type { ObraInput } from "@tn/shared";
import type { Catalog } from "./catalog.js";
import { pickBestMaterial, pickBestServicio } from "./preferGroup.js";
import { quote } from "./quote.js";

const catalog: Catalog = {
  materiales: [
    {
      sku: "CABLE-TREFILCON-1X2.5",
      nombre: "Cable Trefilcon 1×2,5 × 100m",
      marca: "Trefilcon",
      empresa: "TN_MATERIALES",
      subUnidad: "ELECTRICOS",
      unidad: "rollo",
      precioARS: 65000,
      benchmarkARS: 72000,
      stock: 500,
    },
    {
      sku: "TABLERO-12P",
      nombre: "Tablero 12 polos",
      empresa: "TN_MATERIALES",
      subUnidad: "ELECTRICOS",
      unidad: "u",
      precioARS: 48000,
      benchmarkARS: 56000,
      stock: 80,
    },
    {
      sku: "INODORO-LOZA",
      nombre: "Inodoro de loza",
      empresa: "TN_MATERIALES",
      subUnidad: "SANITARIOS",
      unidad: "u",
      precioARS: 95000,
      benchmarkARS: 115000,
      stock: 40,
    },
    {
      sku: "GRIFERIA-MONO",
      nombre: "Griferia mono",
      empresa: "TN_MATERIALES",
      subUnidad: "SANITARIOS",
      unidad: "u",
      precioARS: 55000,
      benchmarkARS: 68000,
      stock: 60,
    },
    {
      sku: "CANO-PPN-32",
      nombre: "Caño PPN 32mm",
      empresa: "TN_MATERIALES",
      subUnidad: "SANITARIOS",
      unidad: "u",
      precioARS: 4200,
      benchmarkARS: 5200,
      stock: 500,
    },
    {
      sku: "ARENA-GRUESA-M3",
      nombre: "Arena gruesa",
      empresa: "TN_MATERIALES",
      subUnidad: "ARIDOS",
      unidad: "m3",
      precioARS: 22000,
      benchmarkARS: 26000,
      stock: 2000,
    },
    {
      sku: "CEMENTO-50KG",
      nombre: "Cemento 50kg",
      empresa: "TN_MATERIALES",
      subUnidad: "ARIDOS",
      unidad: "bolsa",
      precioARS: 8500,
      benchmarkARS: 9800,
      stock: 5000,
    },
    {
      sku: "LADRILLO-HUECO-18",
      nombre: "Ladrillo hueco 18",
      empresa: "TN_MATERIALES",
      subUnidad: "ARIDOS",
      unidad: "u",
      precioARS: 950,
      benchmarkARS: 1150,
      stock: 30000,
    },
  ],
  servicios: [
    {
      codigo: "ARQ-PROY",
      nombre: "Proyecto arquitectura",
      empresa: "TN_SERVICIOS",
      subUnidad: "ARQUITECTURA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 18000,
      benchmarkARS: 24000,
    },
    {
      codigo: "ING-CALC",
      nombre: "Cálculo estructural",
      empresa: "TN_SERVICIOS",
      subUnidad: "INGENIERIA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 12000,
      benchmarkARS: 16000,
    },
    {
      codigo: "OBRA-MAMP",
      nombre: "Mampostería",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 85000,
      benchmarkARS: 105000,
    },
    {
      codigo: "OBRA-CONTR",
      nombre: "Contrapiso",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 22000,
      benchmarkARS: 28000,
    },
    {
      codigo: "OBRA-INST-ELEC",
      nombre: "Inst. eléctrica MO",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 18000,
      benchmarkARS: 24000,
    },
    {
      codigo: "OBRA-INST-SAN",
      nombre: "Inst. sanitaria MO",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 16000,
      benchmarkARS: 21000,
    },
    {
      codigo: "OBRA-TERM",
      nombre: "Terminaciones",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 45000,
      benchmarkARS: 58000,
    },
    {
      codigo: "OBRA-DIR",
      nombre: "Dirección",
      empresa: "TN_CONSTRUCTORA",
      subUnidad: "OBRA",
      unidad: "m2",
      rendimientoM2: 1,
      precioUnitARS: 9500,
      benchmarkARS: 14000,
    },
  ],
};

const obraBase: ObraInput = {
  tipo: "casa",
  m2: 90,
  ubicacion: "Mar del Plata",
  terminaciones: "medio",
  banos: 2,
  cochera: true,
  tieneTerreno: false,
};

const PEG = 65000;
const USD = 1000;

describe("quote()", () => {
  it("genera líneas para todos los rubros principales", () => {
    const q = quote(obraBase, catalog, { pegARS: PEG, usdARS: USD });
    expect(q.lines.length).toBeGreaterThan(8);
    expect(q.totals.totalARS).toBeGreaterThan(0);
    expect(q.totals.totalTOUP).toBeCloseTo(q.totals.totalARS / PEG, 4);
    expect(q.totals.totalUSD).toBeCloseTo(q.totals.totalARS / USD, 2);
  });

  it("muestra ahorro vs. benchmark de mercado", () => {
    const q = quote(obraBase, catalog, { pegARS: PEG, usdARS: USD });
    expect(q.totals.ahorroARS).toBeGreaterThan(0);
    expect(q.totals.ahorroPct).toBeGreaterThan(10);
  });

  it("desglosa por empresa proveedora", () => {
    const q = quote(obraBase, catalog, { pegARS: PEG, usdARS: USD });
    expect(q.porEmpresa.TN_MATERIALES).toBeGreaterThan(0);
    expect(q.porEmpresa.TN_CONSTRUCTORA).toBeGreaterThan(0);
    expect(q.porEmpresa.TN_SERVICIOS).toBeGreaterThan(0);
    const suma =
      q.porEmpresa.TN_MATERIALES +
      q.porEmpresa.TN_CONSTRUCTORA +
      q.porEmpresa.TN_SERVICIOS +
      q.porEmpresa.EXTERNO +
      q.porEmpresa.TN_INMOBILIARIA +
      q.porEmpresa.TN_ADMINISTRACION;
    expect(suma).toBeCloseTo(q.totals.totalARS, 0);
  });

  it("terminación premium cuesta más que básico", () => {
    const basico = quote({ ...obraBase, terminaciones: "basico" }, catalog, {
      pegARS: PEG,
      usdARS: USD,
    });
    const premium = quote({ ...obraBase, terminaciones: "premium" }, catalog, {
      pegARS: PEG,
      usdARS: USD,
    });
    expect(premium.totals.totalARS).toBeGreaterThan(basico.totals.totalARS);
  });

  it("escala lineal con m²", () => {
    const a = quote({ ...obraBase, m2: 60 }, catalog, { pegARS: PEG, usdARS: USD });
    const b = quote({ ...obraBase, m2: 120 }, catalog, { pegARS: PEG, usdARS: USD });
    // No es exactamente 2x porque hay items con cantidades absolutas (tablero, sanitarios)
    expect(b.totals.totalARS).toBeGreaterThan(a.totals.totalARS * 1.6);
    expect(b.totals.totalARS).toBeLessThan(a.totals.totalARS * 2.4);
  });

  it("refacción omite arquitectura y cálculo", () => {
    const q = quote({ ...obraBase, tipo: "refaccion" }, catalog, {
      pegARS: PEG,
      usdARS: USD,
    });
    const rubros = q.lines.map((l) => l.rubro);
    expect(rubros).not.toContain("Proyecto de arquitectura");
    expect(rubros).not.toContain("Cálculo estructural");
  });

  it("m² extremo bajo reduce confianza", () => {
    const q = quote({ ...obraBase, m2: 15 }, catalog, { pegARS: PEG, usdARS: USD });
    expect(q.confianza).toBeLessThan(0.9);
  });
});

describe("preferGroup", () => {
  it("prefiere grupo si está dentro de tolerancia", () => {
    const m = pickBestMaterial(
      [
        {
          sku: "A",
          nombre: "X",
          empresa: "TN_MATERIALES",
          subUnidad: "ELECTRICOS",
          unidad: "u",
          precioARS: 105,
          benchmarkARS: 100,
          stock: 10,
        },
        {
          sku: "B",
          nombre: "X-ext",
          empresa: "EXTERNO",
          subUnidad: "ELECTRICOS",
          unidad: "u",
          precioARS: 100,
          benchmarkARS: 100,
          stock: 10,
        },
      ],
      { toleranciaPct: 10 },
    );
    expect(m?.empresa).toBe("TN_MATERIALES");
  });

  it("cae a externo si grupo se excede de la tolerancia", () => {
    const m = pickBestMaterial(
      [
        {
          sku: "A",
          nombre: "X",
          empresa: "TN_MATERIALES",
          subUnidad: "ELECTRICOS",
          unidad: "u",
          precioARS: 200,
          benchmarkARS: 100,
          stock: 10,
        },
        {
          sku: "B",
          nombre: "X-ext",
          empresa: "EXTERNO",
          subUnidad: "ELECTRICOS",
          unidad: "u",
          precioARS: 100,
          benchmarkARS: 100,
          stock: 10,
        },
      ],
      { toleranciaPct: 5 },
    );
    expect(m?.empresa).toBe("EXTERNO");
  });

  it("pickBestServicio mismo criterio", () => {
    const s = pickBestServicio(
      [
        {
          codigo: "A",
          nombre: "x",
          empresa: "TN_CONSTRUCTORA",
          subUnidad: "OBRA",
          unidad: "m2",
          rendimientoM2: 1,
          precioUnitARS: 100,
          benchmarkARS: 100,
        },
        {
          codigo: "B",
          nombre: "y",
          empresa: "EXTERNO",
          subUnidad: "OBRA",
          unidad: "m2",
          rendimientoM2: 1,
          precioUnitARS: 95,
          benchmarkARS: 100,
        },
      ],
      { toleranciaPct: 10 },
    );
    expect(s?.empresa).toBe("TN_CONSTRUCTORA");
  });
});
