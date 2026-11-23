import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { factura } from './factura';
import { usuario } from './usuario';

export const historialFactura = pgTable('historial_factura', {
  id: uuid('id').primaryKey().defaultRandom(),
  facturaId: uuid('factura_id').notNull().references(() => factura.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id').references(() => usuario.id),
  evento: varchar('evento', { length: 255 }).notNull(),
  detalle: text('detalle'),
  fechaEvento: timestamp('fecha_evento', { withTimezone: true }).defaultNow(),
}, (table) => [
  // El historial se consulta por factura
  index('idx_historial_factura_factura').on(table.facturaId),
]);
