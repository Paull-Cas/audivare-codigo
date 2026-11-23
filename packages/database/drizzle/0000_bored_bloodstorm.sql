CREATE TYPE "public"."estado_suscripcion" AS ENUM('ACTIVO', 'SUSPENDIDO');--> statement-breakpoint
CREATE TYPE "public"."plan_suscripcion" AS ENUM('BASICO', 'PROFESIONAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_usuario" AS ENUM('SUPERADMIN', 'INTERNO', 'CONTADOR_EXTERNO');--> statement-breakpoint
CREATE TYPE "public"."estado_invitacion" AS ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REVOCADA');--> statement-breakpoint
CREATE TYPE "public"."documentacion_estado" AS ENUM('PENDIENTE', 'COMPLETA');--> statement-breakpoint
CREATE TYPE "public"."estado_factura" AS ENUM('ACTIVA', 'PAGADA');--> statement-breakpoint
CREATE TYPE "public"."moneda_factura" AS ENUM('PEN', 'USD');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('GUIA_REMISION', 'ORDEN_COMPRA', 'COTIZACION', 'CONTRATO_COMPRA', 'OTROS');--> statement-breakpoint
CREATE TYPE "public"."tipo_observacion" AS ENUM('INTERNA', 'EXTERNA');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacion" AS ENUM('INVITACION_EMPRESA', 'REMOVIDO_EMPRESA', 'INVITACION_ACEPTADA', 'INVITACION_RECHAZADA', 'OBSERVACION_CREADA', 'OBSERVACION_ATENDIDA', 'FACTURAS_IMPORTADAS', 'DOCUMENTO_CARGADO', 'DOCUMENTACION_COMPLETADA', 'PAGO_REGISTRADO');--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_registro" varchar(255) NOT NULL,
	"ruc" varchar(20),
	"razon_social" varchar(255),
	"plan_suscripcion" "plan_suscripcion" DEFAULT 'BASICO',
	"estado_suscripcion" "estado_suscripcion" DEFAULT 'ACTIVO',
	"fecha_creacion" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nombre_completo" varchar(255),
	"password_hash" varchar(255),
	"tipo_usuario" "tipo_usuario" NOT NULL,
	"avatar_url" varchar(512),
	"fecha_registro" timestamp with time zone DEFAULT now(),
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rol" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre_rol" varchar(100) NOT NULL,
	"descripcion" text,
	"es_inmutable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permiso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo_permiso" varchar(100) NOT NULL,
	"descripcion" varchar(255),
	CONSTRAINT "permiso_codigo_permiso_unique" UNIQUE("codigo_permiso")
);
--> statement-breakpoint
CREATE TABLE "rol_permiso" (
	"rol_id" uuid NOT NULL,
	"permiso_id" uuid NOT NULL,
	CONSTRAINT "rol_permiso_rol_id_permiso_id_pk" PRIMARY KEY("rol_id","permiso_id")
);
--> statement-breakpoint
CREATE TABLE "usuario_interno_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"rol_id" uuid NOT NULL,
	"estado" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "invitacion_contador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contador_email" varchar(255) NOT NULL,
	"estado_invitacion" "estado_invitacion" DEFAULT 'PENDIENTE',
	"fecha_envio" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relacion_empresa_contador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contador_id" uuid NOT NULL,
	"fecha_vinculacion" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "factura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"serie" varchar(20),
	"numero" varchar(20),
	"proveedor_ruc" varchar(20),
	"proveedor_nombre" varchar(255),
	"receptor_ruc" varchar(20),
	"receptor_razon_social" varchar(255),
	"moneda" "moneda_factura" DEFAULT 'PEN' NOT NULL,
	"monto_total" numeric(12, 2),
	"saldo_pendiente" numeric(12, 2),
	"fecha_emision" date,
	"estado_factura" "estado_factura" DEFAULT 'ACTIVA' NOT NULL,
	"documentacion_estado" "documentacion_estado" DEFAULT 'PENDIENTE' NOT NULL,
	"documentacion_completada_por" uuid,
	"documentacion_completada_en" timestamp with time zone,
	"creado_por" uuid,
	"fecha_creacion" timestamp with time zone DEFAULT now(),
	"fecha_actualizacion" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documento_sustento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"tipo_documento" "tipo_documento" NOT NULL,
	"descripcion" text,
	"archivo_storage_path" varchar(512) NOT NULL,
	"archivo_nombre_original" varchar(255) NOT NULL,
	"subido_por" uuid,
	"fecha_subida" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pago_factura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"monto_pagado" numeric(12, 2) NOT NULL,
	"comprobante_path" varchar(512),
	"comprobante_nombre" varchar(255),
	"nota" text,
	"registrado_por" uuid,
	"fecha_registro" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "observacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"tipo" "tipo_observacion" NOT NULL,
	"creado_por" uuid NOT NULL,
	"contenido" text NOT NULL,
	"atendida" boolean DEFAULT false,
	"fecha_creacion" timestamp with time zone DEFAULT now(),
	"fecha_atencion" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "historial_factura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factura_id" uuid NOT NULL,
	"usuario_id" uuid,
	"evento" varchar(255) NOT NULL,
	"detalle" text,
	"fecha_evento" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notificacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"mensaje" varchar(500) NOT NULL,
	"leida" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rol" ADD CONSTRAINT "rol_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_rol_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_permiso_id_fk" FOREIGN KEY ("permiso_id") REFERENCES "public"."permiso"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_interno_empresa" ADD CONSTRAINT "usuario_interno_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_interno_empresa" ADD CONSTRAINT "usuario_interno_empresa_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_interno_empresa" ADD CONSTRAINT "usuario_interno_empresa_rol_id_rol_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitacion_contador" ADD CONSTRAINT "invitacion_contador_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacion_empresa_contador" ADD CONSTRAINT "relacion_empresa_contador_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacion_empresa_contador" ADD CONSTRAINT "relacion_empresa_contador_contador_id_usuario_id_fk" FOREIGN KEY ("contador_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_documentacion_completada_por_usuario_id_fk" FOREIGN KEY ("documentacion_completada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_creado_por_usuario_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_sustento" ADD CONSTRAINT "documento_sustento_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_sustento" ADD CONSTRAINT "documento_sustento_subido_por_usuario_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_factura" ADD CONSTRAINT "pago_factura_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_factura" ADD CONSTRAINT "pago_factura_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_creado_por_usuario_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_factura" ADD CONSTRAINT "historial_factura_factura_id_factura_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."factura"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_factura" ADD CONSTRAINT "historial_factura_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_factura_empresa_fecha" ON "factura" USING btree ("empresa_id","fecha_emision" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_documento_factura" ON "documento_sustento" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "idx_pago_factura_factura" ON "pago_factura" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "idx_observacion_factura" ON "observacion" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "idx_historial_factura_factura" ON "historial_factura" USING btree ("factura_id");