DROP INDEX "uq_factura_importacion_ruc";--> statement-breakpoint
DROP INDEX "uq_factura_importacion_nombre";--> statement-breakpoint
ALTER TABLE "factura" ADD COLUMN "tipo_comprobante" varchar(2) DEFAULT '01' NOT NULL;--> statement-breakpoint
ALTER TABLE "factura" ADD COLUMN "clave_identidad" varchar(100);--> statement-breakpoint
ALTER TABLE "factura" ADD COLUMN "base_imponible" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "factura" ADD COLUMN "igv" numeric(12, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_factura_identidad" ON "factura" USING btree ("empresa_id","clave_identidad");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_factura_importacion_ruc" ON "factura" USING btree ("empresa_id","tipo_comprobante","serie","numero","proveedor_ruc") WHERE "factura"."serie" is not null and "factura"."numero" is not null and "factura"."proveedor_ruc" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_factura_importacion_nombre" ON "factura" USING btree ("empresa_id","tipo_comprobante","serie","numero",coalesce("proveedor_nombre", '')) WHERE "factura"."serie" is not null and "factura"."numero" is not null and "factura"."proveedor_ruc" is null;
--> statement-breakpoint
-- Solo se completa la clave en grupos inequívocos. Los duplicados históricos se
-- conservan sin fusionar/borrar y deben revisarse antes de editar su identidad.
WITH claves AS (
 SELECT id, empresa_id, concat(regexp_replace(proveedor_ruc, '[[:space:]]', '', 'g'), '|', tipo_comprobante, '|',
 upper(regexp_replace(serie, '[[:space:]]', '', 'g')), '|',
 regexp_replace(regexp_replace(numero, '[[:space:]]', '', 'g'), '^0+(?=[0-9])', '')) AS clave
 FROM factura WHERE proveedor_ruc ~ '^[0-9]{11}$' AND serie IS NOT NULL AND numero IS NOT NULL
), unicas AS (SELECT empresa_id, clave FROM claves GROUP BY empresa_id, clave HAVING count(*) = 1)
UPDATE factura f SET clave_identidad = c.clave FROM claves c JOIN unicas u USING (empresa_id, clave) WHERE f.id = c.id;
--> statement-breakpoint
INSERT INTO permiso (codigo_permiso, descripcion) VALUES
 ('FACTURA_CREATE', 'Registrar facturas individualmente'),
 ('FACTURA_UPDATE', 'Editar datos de facturas con historial') ON CONFLICT (codigo_permiso) DO NOTHING;
