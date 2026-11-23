CREATE TABLE "superadmin_permiso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"codigo_permiso" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "es_superadmin_principal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "superadmin_permiso" ADD CONSTRAINT "superadmin_permiso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;