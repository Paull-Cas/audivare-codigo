CREATE TYPE "public"."tipo_pago" AS ENUM('NORMAL', 'DETRACCION');--> statement-breakpoint
ALTER TABLE "pago_factura" ADD COLUMN "tipo_pago" "tipo_pago" DEFAULT 'NORMAL' NOT NULL;