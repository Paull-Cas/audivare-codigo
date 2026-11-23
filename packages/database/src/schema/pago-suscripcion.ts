import { pgTable, uuid, decimal, date, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { empresa } from './empresa';
import { usuario } from './usuario';

// Pago del servicio AudiVare registrado manualmente por el superadmin. Cada pago
// define cuántos meses cubre; los registros anteriores conservan el comportamiento
// original de un mes mediante el valor por defecto.
export const pagoSuscripcion = pgTable('pago_suscripcion', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresa.id, { onDelete: 'cascade' }),
  monto: decimal('monto', { precision: 12, scale: 2 }).notNull(),
  fechaPago: date('fecha_pago').notNull(),
  duracionMeses: integer('duracion_meses').notNull().default(1),
  registradoPor: uuid('registrado_por').references(() => usuario.id),
  fechaRegistro: timestamp('fecha_registro', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // El ciclo de cada empresa se resuelve con su último pago (max fecha_pago)
  index('idx_pago_suscripcion_empresa').on(table.empresaId, table.fechaPago),
]);
