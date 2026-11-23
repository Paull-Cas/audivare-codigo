import { BadRequestException } from '@nestjs/common';
import { factura } from '@audivare/database';
import { sql } from 'drizzle-orm';

export interface DatosFactura {
  tipoComprobante: string; serie: string; numero: string; proveedorRuc: string;
  proveedorNombre: string; fechaEmision: string; moneda: 'PEN' | 'USD';
  montoTotal: string; baseImponible: string | null; igv: string | null;
}

export function claveFactura(d: { tipoComprobante?: string; serie: string | null; numero: string | null; proveedorRuc: string | null }) {
  return [d.proveedorRuc?.replace(/\s/g, ''), (d.tipoComprobante ?? '01').padStart(2, '0'),
    d.serie?.replace(/\s/g, '').toUpperCase(), d.numero?.replace(/\s/g, '').replace(/^0+(?=\d)/, '')].join('|');
}

// Incluye registros antiguos sin clave y no modifica ni fusiona esos registros.
export const claveFacturaSql = sql<string>`concat(regexp_replace(${factura.proveedorRuc}, '[[:space:]]', '', 'g'), '|',
  ${factura.tipoComprobante}, '|', upper(regexp_replace(${factura.serie}, '[[:space:]]', '', 'g')), '|',
  regexp_replace(regexp_replace(${factura.numero}, '[[:space:]]', '', 'g'), '^0+(?=[0-9])', ''))`;

export function fechaValida(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) > 0 && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}

export function validarDatosFactura(body: unknown): DatosFactura {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Datos de factura inválidos');
  const b = body as Record<string, unknown>;
  const texto = (k: string, max: number) => {
    if (typeof b[k] !== 'string' || !(b[k] as string).trim() || (b[k] as string).trim().length > max)
      throw new BadRequestException(`El campo ${k} es obligatorio (máximo ${max} caracteres)`);
    return (b[k] as string).trim();
  };
  const dinero = (k: string, opcional = false): string | null => {
    const v = b[k];
    if (opcional && (v === undefined || v === null || v === '')) return null;
    if ((typeof v !== 'string' && typeof v !== 'number') || !/^\d{1,10}(\.\d{1,2})?$/.test(String(v)))
      throw new BadRequestException(`${k}: utiliza un importe positivo con hasta dos decimales`);
    return (Math.round(Number(v) * 100) / 100).toFixed(2);
  };
  const tipoComprobante = texto('tipoComprobante', 2).padStart(2, '0');
  if (!['01', '03', '07', '08'].includes(tipoComprobante)) throw new BadRequestException('Tipo de comprobante no admitido');
  const serie = texto('serie', 20).replace(/\s/g, '').toUpperCase();
  const numero = texto('numero', 20).replace(/^0+(?=\d)/, '');
  const proveedorRuc = texto('proveedorRuc', 20).replace(/\s/g, '');
  if (!/^[A-Z0-9]+$/.test(serie) || !/^\d+$/.test(numero) || !/^\d{11}$/.test(proveedorRuc))
    throw new BadRequestException('Revisa la serie, el número y el RUC de 11 dígitos');
  const fechaEmision = texto('fechaEmision', 10);
  if (!fechaValida(fechaEmision)) throw new BadRequestException('Fecha de emisión inválida');
  if (b.moneda !== 'PEN' && b.moneda !== 'USD') throw new BadRequestException('Moneda no admitida');
  const montoTotal = dinero('montoTotal')!;
  if (Number(montoTotal) <= 0) throw new BadRequestException('El total debe ser mayor a cero');
  const baseImponible = dinero('baseImponible', true), igv = dinero('igv', true);
  if ((baseImponible !== null && Number(baseImponible) > Number(montoTotal)) || (igv !== null && Number(igv) > Number(montoTotal)))
    throw new BadRequestException('La base y el IGV no pueden superar el total');
  return { tipoComprobante, serie, numero, proveedorRuc, proveedorNombre: texto('proveedorNombre', 255), fechaEmision,
    moneda: b.moneda, montoTotal, baseImponible, igv };
}
