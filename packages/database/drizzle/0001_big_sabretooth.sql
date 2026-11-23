ALTER TYPE "public"."tipo_documento" ADD VALUE 'ORDEN_SERVICIO' BEFORE 'COTIZACION';--> statement-breakpoint
ALTER TYPE "public"."tipo_documento" ADD VALUE 'CONFORMIDAD' BEFORE 'OTROS';--> statement-breakpoint
ALTER TYPE "public"."tipo_documento" ADD VALUE 'CONSTANCIA_DETRACCION' BEFORE 'OTROS';--> statement-breakpoint
ALTER TABLE "observacion" ADD COLUMN "respuesta" text;