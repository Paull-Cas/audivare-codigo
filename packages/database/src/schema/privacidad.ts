import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

// Sin FK: conservar evidencia aunque se elimine cuenta/empresa.
export const auditoriaOperacion = pgTable('auditoria_operacion', {
  id: uuid('id').primaryKey(),
  actorId: uuid('actor_id'),
  sesionId: uuid('sesion_id'),
  metodo: varchar('metodo', { length: 10 }).notNull(),
  ruta: varchar('ruta', { length: 255 }).notNull(),
  recursos: jsonb('recursos').$type<Record<string, string>>().notNull(),
  estado: varchar('estado', { length: 20 }).notNull().default('PENDIENTE'),
  codigoHttp: integer('codigo_http'),
  iniciadaEn: timestamp('iniciada_en', { withTimezone: true }).notNull().default(sql`date_trunc('milliseconds', now())`),
  terminadaEn: timestamp('terminada_en', { withTimezone: true }),
}, t => [index('idx_auditoria_fecha').on(t.iniciadaEn), index('idx_auditoria_actor').on(t.actorId, t.iniciadaEn)]);

export const expedientePrivacidad = pgTable('expediente_privacidad', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: varchar('tipo', { length: 30 }).notNull(),
  correo: varchar('correo', { length: 254 }),
  descripcion: text('descripcion').notNull(),
  estado: varchar('estado', { length: 20 }).notNull().default('RECIBIDA'),
  verificadaEn: timestamp('verificada_en', { withTimezone: true }),
  plazoEn: timestamp('plazo_en', { withTimezone: true }),
  creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().default(sql`date_trunc('milliseconds', now())`),
}, t => [index('idx_privacidad_fecha').on(t.creadaEn)]);

export const expedienteEvento = pgTable('expediente_evento', {
  id: uuid('id').primaryKey().defaultRandom(),
  expedienteId: uuid('expediente_id').notNull().references(() => expedientePrivacidad.id),
  actorId: uuid('actor_id').notNull(),
  estado: varchar('estado', { length: 20 }).notNull(),
  nota: text('nota').notNull(),
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('idx_expediente_eventos').on(t.expedienteId, t.fecha)]);
