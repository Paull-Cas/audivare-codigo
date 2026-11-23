ALTER TABLE "documento_sustento" ALTER COLUMN "tipo_documento" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tipo_documento";--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('GUIA_REMISION_REMITENTE', 'GUIA_REMISION_TRANSPORTISTA', 'COTIZACION', 'CONTRATO', 'OTROS');--> statement-breakpoint
UPDATE "documento_sustento" SET "descripcion" = COALESCE("descripcion", CASE "tipo_documento" WHEN 'ORDEN_COMPRA' THEN 'Orden de compra' WHEN 'ORDEN_SERVICIO' THEN 'Orden de servicio' WHEN 'CONFORMIDAD' THEN 'Conformidad' WHEN 'CONSTANCIA_DETRACCION' THEN 'Constancia de detracción' END) WHERE "tipo_documento" IN ('ORDEN_COMPRA', 'ORDEN_SERVICIO', 'CONFORMIDAD', 'CONSTANCIA_DETRACCION');--> statement-breakpoint
UPDATE "documento_sustento" SET "tipo_documento" = 'GUIA_REMISION_REMITENTE' WHERE "tipo_documento" = 'GUIA_REMISION';--> statement-breakpoint
UPDATE "documento_sustento" SET "tipo_documento" = 'CONTRATO' WHERE "tipo_documento" = 'CONTRATO_COMPRA';--> statement-breakpoint
UPDATE "documento_sustento" SET "tipo_documento" = 'OTROS' WHERE "tipo_documento" IN ('ORDEN_COMPRA', 'ORDEN_SERVICIO', 'CONFORMIDAD', 'CONSTANCIA_DETRACCION');--> statement-breakpoint
ALTER TABLE "documento_sustento" ALTER COLUMN "tipo_documento" SET DATA TYPE "public"."tipo_documento" USING "tipo_documento"::"public"."tipo_documento";
