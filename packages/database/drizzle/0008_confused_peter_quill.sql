ALTER TYPE "public"."tipo_notificacion" ADD VALUE 'FACTURAS_ELIMINADAS' BEFORE 'DOCUMENTO_CARGADO';--> statement-breakpoint
CREATE TABLE "lote_importacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contador_id" uuid,
	"nombre_archivo" varchar(255),
	"total_filas" integer DEFAULT 0 NOT NULL,
	"creadas" integer DEFAULT 0 NOT NULL,
	"revertido_en" timestamp with time zone,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factura" ADD COLUMN "lote_importacion_id" uuid;--> statement-breakpoint
ALTER TABLE "lote_importacion" ADD CONSTRAINT "lote_importacion_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote_importacion" ADD CONSTRAINT "lote_importacion_contador_id_usuario_id_fk" FOREIGN KEY ("contador_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lote_importacion_empresa" ON "lote_importacion" USING btree ("empresa_id","fecha_creacion" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "factura" ADD CONSTRAINT "factura_lote_importacion_id_lote_importacion_id_fk" FOREIGN KEY ("lote_importacion_id") REFERENCES "public"."lote_importacion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_factura_lote" ON "factura" USING btree ("lote_importacion_id");