ALTER TYPE "public"."tipo_notificacion" ADD VALUE 'DOCUMENTO_EMPRESA_CARGADO' BEFORE 'DOCUMENTACION_COMPLETADA';--> statement-breakpoint
CREATE TABLE "documento_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descripcion" text,
	"anio" integer,
	"mes" integer,
	"archivo_storage_path" varchar(512) NOT NULL,
	"archivo_nombre_original" varchar(255) NOT NULL,
	"subido_por" uuid,
	"fecha_subida" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_empresa" ADD CONSTRAINT "documento_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_empresa" ADD CONSTRAINT "documento_empresa_subido_por_usuario_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documento_empresa_empresa" ON "documento_empresa" USING btree ("empresa_id","fecha_subida" DESC NULLS LAST);