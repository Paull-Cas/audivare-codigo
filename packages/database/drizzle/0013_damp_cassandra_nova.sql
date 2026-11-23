ALTER TYPE "public"."tipo_notificacion" ADD VALUE 'MENSAJE_DOC_EMPRESA' BEFORE 'DOCUMENTACION_COMPLETADA';--> statement-breakpoint
CREATE TABLE "mensaje_documento_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"autor_id" uuid,
	"de_contador" boolean NOT NULL,
	"contenido" text NOT NULL,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensaje_documento_empresa" ADD CONSTRAINT "mensaje_documento_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje_documento_empresa" ADD CONSTRAINT "mensaje_documento_empresa_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mensaje_doc_empresa_empresa" ON "mensaje_documento_empresa" USING btree ("empresa_id","fecha_creacion");