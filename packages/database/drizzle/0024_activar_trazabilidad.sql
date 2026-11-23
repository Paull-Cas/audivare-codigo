CREATE FUNCTION auditar_cambio_datos() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fila jsonb;
  referencias jsonb := '{}'::jsonb;
  clave text;
  valor text;
BEGIN
  IF TG_OP <> 'TRUNCATE' THEN
    IF TG_OP = 'DELETE' THEN fila := to_jsonb(OLD); ELSE fila := to_jsonb(NEW); END IF;
    FOREACH clave IN ARRAY ARRAY['id','empresa_id','usuario_id','factura_id','contador_id','expediente_id','rol_id','permiso_id'] LOOP
      valor := fila->>clave;
      IF valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        referencias := referencias || jsonb_build_object(clave, valor);
      END IF;
    END LOOP;
  END IF;
  INSERT INTO auditoria_operacion(id,metodo,ruta,recursos,estado,codigo_http,terminada_en)
  VALUES(gen_random_uuid(),TG_OP,'BD/' || TG_TABLE_NAME,referencias,'RESPONDIDA',NULL,clock_timestamp());
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER empresa_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "empresa" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER empresa_auditar_truncate AFTER TRUNCATE ON "empresa" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER usuario_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "usuario" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER usuario_auditar_truncate AFTER TRUNCATE ON "usuario" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER sesion_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "sesion" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER sesion_auditar_truncate AFTER TRUNCATE ON "sesion" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER rol_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "rol" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER rol_auditar_truncate AFTER TRUNCATE ON "rol" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER permiso_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "permiso" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER permiso_auditar_truncate AFTER TRUNCATE ON "permiso" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER rol_permiso_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "rol_permiso" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER rol_permiso_auditar_truncate AFTER TRUNCATE ON "rol_permiso" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER usuario_interno_empresa_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "usuario_interno_empresa" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER usuario_interno_empresa_auditar_truncate AFTER TRUNCATE ON "usuario_interno_empresa" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER invitacion_contador_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "invitacion_contador" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER invitacion_contador_auditar_truncate AFTER TRUNCATE ON "invitacion_contador" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER relacion_empresa_contador_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "relacion_empresa_contador" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER relacion_empresa_contador_auditar_truncate AFTER TRUNCATE ON "relacion_empresa_contador" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER lote_importacion_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "lote_importacion" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER lote_importacion_auditar_truncate AFTER TRUNCATE ON "lote_importacion" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER factura_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "factura" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER factura_auditar_truncate AFTER TRUNCATE ON "factura" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER documento_sustento_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "documento_sustento" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER documento_sustento_auditar_truncate AFTER TRUNCATE ON "documento_sustento" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER documento_empresa_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "documento_empresa" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER documento_empresa_auditar_truncate AFTER TRUNCATE ON "documento_empresa" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER mensaje_documento_empresa_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "mensaje_documento_empresa" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER mensaje_documento_empresa_auditar_truncate AFTER TRUNCATE ON "mensaje_documento_empresa" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER pago_factura_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "pago_factura" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER pago_factura_auditar_truncate AFTER TRUNCATE ON "pago_factura" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER pago_suscripcion_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "pago_suscripcion" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER pago_suscripcion_auditar_truncate AFTER TRUNCATE ON "pago_suscripcion" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER observacion_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "observacion" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER observacion_auditar_truncate AFTER TRUNCATE ON "observacion" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER historial_factura_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "historial_factura" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER historial_factura_auditar_truncate AFTER TRUNCATE ON "historial_factura" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER notificacion_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "notificacion" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER notificacion_auditar_truncate AFTER TRUNCATE ON "notificacion" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER superadmin_permiso_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "superadmin_permiso" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER superadmin_permiso_auditar_truncate AFTER TRUNCATE ON "superadmin_permiso" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER suscripcion_aviso_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "suscripcion_aviso" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER suscripcion_aviso_auditar_truncate AFTER TRUNCATE ON "suscripcion_aviso" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER archivo_analisis_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "archivo_analisis" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER archivo_analisis_auditar_truncate AFTER TRUNCATE ON "archivo_analisis" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER storage_revision_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "storage_revision" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER storage_revision_auditar_truncate AFTER TRUNCATE ON "storage_revision" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER expediente_privacidad_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "expediente_privacidad" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER expediente_privacidad_auditar_truncate AFTER TRUNCATE ON "expediente_privacidad" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER expediente_evento_auditar_cambio AFTER INSERT OR UPDATE OR DELETE ON "expediente_evento" FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER expediente_evento_auditar_truncate AFTER TRUNCATE ON "expediente_evento" FOR EACH STATEMENT EXECUTE FUNCTION auditar_cambio_datos();
