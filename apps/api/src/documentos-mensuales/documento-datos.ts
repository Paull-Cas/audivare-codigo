import { BadRequestException } from "@nestjs/common";

export const CATEGORIAS = [
  "FACTURA",
  "MEDIO_PAGO",
  "GUIA_REMITENTE",
  "GUIA_TRANSPORTISTA",
  "OTRO",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const ETIQUETAS: Record<Categoria, string> = {
  FACTURA: "Factura",
  MEDIO_PAGO: "Medio de pago",
  GUIA_REMITENTE: "Guía de remisión del remitente",
  GUIA_TRANSPORTISTA: "Guía de remisión del transportista",
  OTRO: "Otro documento",
};

export function periodo(anio: unknown, mes: unknown) {
  const entero = (v: unknown) =>
    typeof v === "number"
      ? v
      : typeof v === "string" && /^\d+$/.test(v)
        ? Number(v)
        : NaN;
  const a = entero(anio),
    m = entero(mes);
  if (
    !Number.isInteger(a) ||
    a < 2000 ||
    a > 2100 ||
    !Number.isInteger(m) ||
    m < 1 ||
    m > 12
  ) {
    throw new BadRequestException(
      "Selecciona un año entre 2000 y 2100 y un mes válido",
    );
  }
  return { anio: a, mes: m };
}
export function periodoConsulta(anio: unknown, mes: unknown): { anio?: number; mes?: number } {
  const tieneAnio = anio !== undefined && anio !== '';
  const tieneMes = mes !== undefined && mes !== '';
  if (tieneMes && !tieneAnio) {
    throw new BadRequestException("Selecciona primero un año para filtrar por mes");
  }
  const validado = periodo(tieneAnio ? anio : 2000, tieneMes ? mes : 1);
  return { ...(tieneAnio ? {anio: validado.anio} : {}), ...(tieneMes ? {mes: validado.mes} : {}) };
}
export function categoria(valor: unknown): Categoria {
  if (typeof valor !== "string" || !CATEGORIAS.includes(valor as Categoria))
    throw new BadRequestException("Selecciona un tipo de documento válido");
  return valor as Categoria;
}
export function nota(valor: unknown): string {
  if (typeof valor !== "string" || !valor.trim())
    throw new BadRequestException("Indica una referencia: serie y número, razón social del proveedor u otra descripción de la factura");
  if (
    typeof valor !== "string" ||
    valor.length > 1000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(valor)
  )
    throw new BadRequestException(
      "La nota debe tener como máximo 1000 caracteres",
    );
  return valor.trim();
}
export function seleccion(valor: unknown): Categoria[] {
  if (typeof valor !== "string")
    throw new BadRequestException(
      "Selecciona los documentos que quieres descargar",
    );
  const entradas = valor.split(",").map(categoria);
  if (!entradas.length || entradas.length > CATEGORIAS.length)
    throw new BadRequestException("Selecciona al menos un tipo de documento");
  return CATEGORIAS.filter((c) => entradas.includes(c));
}
