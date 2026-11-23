CREATE TABLE "suscripcion_aviso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ciclo" varchar(100) NOT NULL,
	"etapa" varchar(20) NOT NULL,
	"fecha_creacion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suscripcion_aviso" ADD CONSTRAINT "suscripcion_aviso_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_suscripcion_aviso_ciclo" ON "suscripcion_aviso" USING btree ("empresa_id","ciclo","etapa");