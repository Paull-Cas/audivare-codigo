import { pgTable, uuid, varchar, timestamp, pgEnum, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const planSuscripcionEnum = pgEnum('plan_suscripcion', ['BASICO', 'PROFESIONAL']);
// PENDIENTE corresponde al modelo anterior sin prueba. Registros nuevos nacen
// ACTIVO y autorizan por prueba/periodo, sin cambiar el estado manual al vencer.
// SUSPENDIDO prevalece sobre su vigencia; en el modelo anterior puede ser automático.
export const estadoSuscripcionEnum = pgEnum('estado_suscripcion', ['ACTIVO', 'SUSPENDIDO', 'PENDIENTE']);

export const empresa = pgTable('empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailRegistro: varchar('email_registro', { length: 255 }).notNull(),
  ruc: varchar('ruc', { length: 20 }),
  razonSocial: varchar('razon_social', { length: 255 }),
  planSuscripcion: planSuscripcionEnum('plan_suscripcion').default('BASICO'),
  estadoSuscripcion: estadoSuscripcionEnum('estado_suscripcion').default('ACTIVO'),
  // Máximo de usuarios internos (vínculos usuario_interno_empresa); lo ajusta el superadmin
  limiteUsuarios: integer('limite_usuarios').notNull().default(2),
  // Ciclo de pago del servicio: cuándo se envió el último aviso de vencimiento
  // (para no repetirlo dentro del mismo ciclo) y si la suspensión vigente fue
  // automática por falta de pago (se revierte sola al registrar un nuevo pago).
  ultimoAvisoPago: timestamp('ultimo_aviso_pago', { withTimezone: true }),
  suspendidaPorPago: boolean('suspendida_por_pago').notNull().default(false),
  // Solo registros nuevos: null conserva el tratamiento de empresas anteriores.
  pruebaHasta: timestamp('prueba_hasta', { withTimezone: true }),
  fechaCreacion: timestamp('fecha_creacion', { withTimezone: true }).defaultNow(),
}, table => [uniqueIndex('uq_empresa_ruc').on(table.ruc)]);
