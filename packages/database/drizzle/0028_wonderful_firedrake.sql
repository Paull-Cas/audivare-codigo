CREATE TYPE "public"."categoria_documento" AS ENUM('FACTURA', 'MEDIO_PAGO', 'GUIA_REMITENTE', 'GUIA_TRANSPORTISTA', 'OTRO');--> statement-breakpoint
CREATE TABLE "documento_mensual" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"categoria" "categoria_documento" NOT NULL,
	"nota" varchar(1000),
	"archivo_path" varchar(512) NOT NULL,
	"archivo_nombre" varchar(255) NOT NULL,
	"archivo_mime" varchar(30) NOT NULL,
	"archivo_bytes" integer NOT NULL,
	"creado_por" uuid NOT NULL,
	"fecha_carga" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "mensual_periodo_valido" CHECK ("documento_mensual"."anio" BETWEEN 2000 AND 2100 AND "documento_mensual"."mes" BETWEEN 1 AND 12),
	CONSTRAINT "mensual_bytes_validos" CHECK ("documento_mensual"."archivo_bytes" > 0 AND "documento_mensual"."archivo_bytes" <= 10485760),
	CONSTRAINT "mensual_mime_valido" CHECK ("documento_mensual"."archivo_mime" IN ('application/pdf','image/png','image/jpeg'))
);
--> statement-breakpoint
CREATE TABLE "evento_documento_mensual" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"accion" varchar(20) NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_mensual_accion_valida" CHECK ("evento_documento_mensual"."accion" IN ('CARGA','EDICION','ELIMINACION'))
);
--> statement-breakpoint
ALTER TABLE "documento_mensual" ADD CONSTRAINT "documento_mensual_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_mensual" ADD CONSTRAINT "documento_mensual_creado_por_usuario_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_documento_mensual" ADD CONSTRAINT "evento_documento_mensual_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_documento_mensual" ADD CONSTRAINT "evento_documento_mensual_documento_id_documento_mensual_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento_mensual"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_documento_mensual" ADD CONSTRAINT "evento_documento_mensual_actor_id_usuario_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mensual_periodo" ON "documento_mensual" USING btree ("empresa_id","anio","mes","categoria","fecha_carga","id");--> statement-breakpoint
CREATE INDEX "idx_evento_mensual_empresa" ON "evento_documento_mensual" USING btree ("empresa_id","fecha","id");--> statement-breakpoint
INSERT INTO permiso (codigo_permiso, descripcion) VALUES
('DOCUMENTO_MENSUAL_READ','Consultar documentos mensuales y su actividad'),
('DOCUMENTO_MENSUAL_CREATE','Cargar facturas y sustentos mensuales'),
('DOCUMENTO_MENSUAL_UPDATE','Editar periodo y nota de documentos mensuales'),
('DOCUMENTO_MENSUAL_DELETE','Eliminar documentos mensuales'),
('DOCUMENTO_MENSUAL_EXPORT','Descargar PDF de documentos mensuales') ON CONFLICT (codigo_permiso) DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER documento_mensual_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON documento_mensual FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER evento_documento_mensual_auditar_cambio AFTER INSERT ON evento_documento_mensual FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE FUNCTION conservar_evento_mensual() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'El historial documental no se puede modificar ni eliminar'; END $$;
--> statement-breakpoint
CREATE TRIGGER evento_mensual_inmutable BEFORE UPDATE OR DELETE ON evento_documento_mensual FOR EACH ROW EXECUTE FUNCTION conservar_evento_mensual();
--> statement-breakpoint
CREATE TRIGGER evento_mensual_no_truncate BEFORE TRUNCATE ON evento_documento_mensual FOR EACH STATEMENT EXECUTE FUNCTION conservar_evento_mensual();
