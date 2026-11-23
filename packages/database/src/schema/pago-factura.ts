import { pgTable, uuid, varchar, decimal, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { factura } from './factura';
import { usuario } from './usuario';

// Clasificación del pago: NORMAL (pago corriente al proveedor) o DETRACCION
// (depósito del SPOT al Banco de la Nación). Ambos reducen el saldo por igual;
// es solo una marca contable. Por defecto NORMAL.
export const tipoPagoEnum = pgEnum('tipo_pago', ['NORMAL', 'DETRACCION']);

// Un pago registra: monto, comprobante (obligatorio), una nota libre y su tipo
// (normal/detracción). Sin fecha ni método de pago. El saldo se recalcula desde
// estos montos y la factura pasa a PAGADA cuando el saldo llega a 0.
export const pagoFactura = pgTable('pago_factura', {
  id: uuid('id').primaryKey().defaultRandom(),
  facturaId: uuid('factura_id').notNull().references(() => factura.id, { onDelete: 'cascade' }),
  montoPagado: decimal('monto_pagado', { precision: 12, scale: 2 }).notNull(),
  tipoPago: tipoPagoEnum('tipo_pago').notNull().default('NORMAL'),
  comprobantePath: varchar('comprobante_path', { length: 512 }),
  comprobanteNombre: varchar('comprobante_nombre', { length: 255 }),
  nota: text('nota'),
  registradoPor: uuid('registrado_por').references(() => usuario.id),
  fechaRegistro: timestamp('fecha_registro', { withTimezone: true }).defaultNow(),
}, (table) => [
  // Los pagos se consultan por factura (y el consolidado hace join sobre factura)
  index('idx_pago_factura_factura').on(table.facturaId),
]);
