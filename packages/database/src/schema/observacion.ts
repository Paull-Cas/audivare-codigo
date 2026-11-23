import { pgTable, uuid, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { factura } from './factura';
import { usuario } from './usuario';

// Solicitud/observación sobre una factura. Hoy solo se usa EXTERNA: el contador
// envía una **solicitud** de documentación a la empresa; la empresa la atiende
// respondiendo con una nota (`respuesta`). INTERNA se conserva por compatibilidad.
export const tipoObservacionEnum = pgEnum('tipo_observacion', ['INTERNA', 'EXTERNA']);

export const observacion = pgTable('observacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  facturaId: uuid('factura_id').notNull().references(() => factura.id, { onDelete: 'cascade' }),
  tipo: tipoObservacionEnum('tipo').notNull(),
  creadoPor: uuid('creado_por').notNull().references(() => usuario.id),
  contenido: text('contenido').notNull(),
  atendida: boolean('atendida').default(false),
  // Respuesta de la empresa al atender la solicitud (opcional).
  respuesta: text('respuesta'),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow(),
  fechaAtencion: timestamp('fecha_atencion', { withTimezone: true }),
}, (table) => [
  // Las observaciones se consultan por factura
  index('idx_observacion_factura').on(table.facturaId),
]);
