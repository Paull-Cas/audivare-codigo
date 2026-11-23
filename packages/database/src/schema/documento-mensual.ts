import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  varchar,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { empresa } from "./empresa";
import { usuario } from "./usuario";

export const categoriaDocumentoEnum = pgEnum("categoria_documento", [
  "FACTURA",
  "MEDIO_PAGO",
  "GUIA_REMITENTE",
  "GUIA_TRANSPORTISTA",
  "OTRO",
]);
export const documentoMensual = pgTable(
  "documento_mensual",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    categoria: categoriaDocumentoEnum("categoria").notNull(),
    nota: varchar("nota", { length: 1000 }),
    archivoPath: varchar("archivo_path", { length: 512 }).notNull(),
    archivoNombre: varchar("archivo_nombre", { length: 255 }).notNull(),
    archivoMime: varchar("archivo_mime", { length: 30 }).notNull(),
    archivoBytes: integer("archivo_bytes").notNull(),
    creadoPor: uuid("creado_por")
      .notNull()
      .references(() => usuario.id),
    fechaCarga: timestamp("fecha_carga", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    index("idx_mensual_periodo").on(
      t.empresaId,
      t.anio,
      t.mes,
      t.categoria,
      t.fechaCarga,
      t.id,
    ),
    check(
      "mensual_periodo_valido",
      sql`${t.anio} BETWEEN 2000 AND 2100 AND ${t.mes} BETWEEN 1 AND 12`,
    ),
    check(
      "mensual_bytes_validos",
      sql`${t.archivoBytes} > 0 AND ${t.archivoBytes} <= 10485760`,
    ),
    check(
      "mensual_mime_valido",
      sql`${t.archivoMime} IN ('application/pdf','image/png','image/jpeg')`,
    ),
  ],
);

export const eventoDocumentoMensual = pgTable(
  "evento_documento_mensual",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresa.id),
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => documentoMensual.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => usuario.id),
    accion: varchar("accion", { length: 20 }).notNull(),
    antes: jsonb("antes").$type<Record<string, unknown>>(),
    despues: jsonb("despues").$type<Record<string, unknown>>(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_evento_mensual_empresa").on(t.empresaId, t.fecha, t.id),
    check(
      "evento_mensual_accion_valida",
      sql`${t.accion} IN ('CARGA','EDICION','ELIMINACION')`,
    ),
  ],
);
