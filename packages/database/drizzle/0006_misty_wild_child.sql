ALTER TYPE "public"."tipo_notificacion" ADD VALUE 'PAGO_SUSCRIPCION_VENCIDO';--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacion" ADD VALUE 'EMPRESA_SUSPENDIDA_POR_PAGO';--> statement-breakpoint
CREATE TABLE "pago_suscripcion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_pago" date NOT NULL,
	"registrado_por" uuid,
	"fecha_registro" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "empresa" ADD COLUMN "ultimo_aviso_pago" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "empresa" ADD COLUMN "suspendida_por_pago" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pago_suscripcion" ADD CONSTRAINT "pago_suscripcion_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_suscripcion" ADD CONSTRAINT "pago_suscripcion_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pago_suscripcion_empresa" ON "pago_suscripcion" USING btree ("empresa_id","fecha_pago");