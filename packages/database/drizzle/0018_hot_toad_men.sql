CREATE TABLE "storage_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"object_path" varchar(512) NOT NULL,
	"motivo" varchar(30) NOT NULL,
	"estado" varchar(20) DEFAULT 'PENDIENTE' NOT NULL,
	"primera_deteccion" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_deteccion" timestamp with time zone DEFAULT now() NOT NULL,
	"proximo_intento" timestamp with time zone,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" varchar(255)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_storage_revision_objeto" ON "storage_revision" USING btree ("bucket","object_path");