CREATE TABLE "aceptacion_legal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid,
	"documento_id" uuid NOT NULL,
	"origen" varchar(20) NOT NULL,
	"representa_empresa" boolean DEFAULT false NOT NULL,
	"aceptada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aceptacion_legal_origen_valido" CHECK ("aceptacion_legal"."origen" IN ('REGISTRO', 'REVISION')),
	CONSTRAINT "aceptacion_legal_representacion_valida" CHECK (("aceptacion_legal"."representa_empresa" AND "aceptacion_legal"."empresa_id" IS NOT NULL) OR (NOT "aceptacion_legal"."representa_empresa" AND "aceptacion_legal"."empresa_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "documento_legal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(40) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"contenido" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_legal_hash_valido" CHECK ("documento_legal"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "aceptacion_legal" ADD CONSTRAINT "aceptacion_legal_documento_id_documento_legal_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento_legal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aceptacion_legal_usuario_documento_unico" ON "aceptacion_legal" USING btree ("usuario_id","documento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documento_legal_version_unico" ON "documento_legal" USING btree ("version");