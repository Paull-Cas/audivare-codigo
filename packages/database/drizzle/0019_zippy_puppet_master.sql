CREATE TABLE "archivo_analisis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"object_path" varchar(512) NOT NULL,
	"estado" varchar(20) NOT NULL,
	"motivo" varchar(40) NOT NULL,
	"sha256" varchar(64),
	"etag" varchar(128),
	"motor" varchar(100),
	"analizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archivo_analisis_objeto" ON "archivo_analisis" USING btree ("bucket","object_path");