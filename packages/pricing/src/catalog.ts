import type { EmpresaCode, SubUnidadCode } from "@tn/shared";

export interface MaterialOffer {
  sku: string;
  nombre: string;
  marca?: string;
  empresa: EmpresaCode | "EXTERNO";
  subUnidad: SubUnidadCode;
  unidad: string;
  precioARS: number;
  benchmarkARS: number;
  stock: number;
}

export interface ServicioOffer {
  codigo: string;
  nombre: string;
  empresa: EmpresaCode | "EXTERNO";
  subUnidad: SubUnidadCode;
  unidad: string;
  rendimientoM2: number;
  precioUnitARS: number;
  benchmarkARS: number;
}

export interface Catalog {
  materiales: MaterialOffer[];
  servicios: ServicioOffer[];
}
