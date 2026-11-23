ALTER TABLE "auditoria_operacion" ALTER COLUMN "iniciada_en" SET DEFAULT date_trunc('milliseconds', now());--> statement-breakpoint
ALTER TABLE "expediente_privacidad" ALTER COLUMN "correo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expediente_privacidad" ALTER COLUMN "creada_en" SET DEFAULT date_trunc('milliseconds', now());