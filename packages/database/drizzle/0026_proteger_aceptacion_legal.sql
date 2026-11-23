CREATE FUNCTION proteger_documento_legal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El texto legal archivado es inmutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER documento_legal_inmutable BEFORE UPDATE OR DELETE OR TRUNCATE ON documento_legal
FOR EACH STATEMENT EXECUTE FUNCTION proteger_documento_legal();
--> statement-breakpoint
CREATE FUNCTION proteger_aceptacion_legal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.aceptada_en < now() - interval '2 years' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'No se permite reescribir ni retirar evidencia legal reciente';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER aceptacion_legal_inmutable BEFORE UPDATE OR DELETE ON aceptacion_legal
FOR EACH ROW EXECUTE FUNCTION proteger_aceptacion_legal();
--> statement-breakpoint
CREATE TRIGGER aceptacion_legal_no_truncate BEFORE TRUNCATE ON aceptacion_legal
FOR EACH STATEMENT EXECUTE FUNCTION proteger_aceptacion_legal();
--> statement-breakpoint
CREATE TRIGGER documento_legal_auditar_cambio AFTER INSERT ON documento_legal
FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
--> statement-breakpoint
CREATE TRIGGER aceptacion_legal_auditar_cambio AFTER INSERT OR DELETE ON aceptacion_legal
FOR EACH ROW EXECUTE FUNCTION auditar_cambio_datos();
