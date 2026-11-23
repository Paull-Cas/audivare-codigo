CREATE TABLE "auditoria_operacion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"sesion_id" uuid,
	"metodo" varchar(10) NOT NULL,
	"ruta" varchar(255) NOT NULL,
	"recursos" jsonb NOT NULL,
	"estado" varchar(20) DEFAULT 'PENDIENTE' NOT NULL,
	"codigo_http" integer,
	"iniciada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expediente_evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expediente_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"estado" varchar(20) NOT NULL,
	"nota" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expediente_privacidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"correo" varchar(254) NOT NULL,
	"descripcion" text NOT NULL,
	"estado" varchar(20) DEFAULT 'RECIBIDA' NOT NULL,
	"verificada_en" timestamp with time zone,
	"plazo_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expediente_evento" ADD CONSTRAINT "expediente_evento_expediente_id_expediente_privacidad_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expediente_privacidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auditoria_fecha" ON "auditoria_operacion" USING btree ("iniciada_en");--> statement-breakpoint
CREATE INDEX "idx_auditoria_actor" ON "auditoria_operacion" USING btree ("actor_id","iniciada_en");--> statement-breakpoint
CREATE INDEX "idx_expediente_eventos" ON "expediente_evento" USING btree ("expediente_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_privacidad_fecha" ON "expediente_privacidad" USING btree ("creada_en");
--> statement-breakpoint
CREATE FUNCTION proteger_auditoria_operacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'No se permite truncar auditoria'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.iniciada_en + interval '2 years' > clock_timestamp() THEN
      RAISE EXCEPTION 'Retencion minima de auditoria: dos anos';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.estado <> 'PENDIENTE' OR NEW.estado <> 'RESPONDIDA'
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.metodo IS DISTINCT FROM OLD.metodo
    OR NEW.ruta IS DISTINCT FROM OLD.ruta OR NEW.recursos IS DISTINCT FROM OLD.recursos
    OR NEW.iniciada_en IS DISTINCT FROM OLD.iniciada_en
    OR NEW.codigo_http IS NULL OR NEW.codigo_http NOT BETWEEN 100 AND 599 OR NEW.terminada_en IS NULL THEN
    RAISE EXCEPTION 'La evidencia de auditoria no se puede reescribir';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER auditoria_retencion BEFORE UPDATE OR DELETE ON auditoria_operacion
FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_operacion();
--> statement-breakpoint
CREATE TRIGGER auditoria_no_truncate BEFORE TRUNCATE ON auditoria_operacion
FOR EACH STATEMENT EXECUTE FUNCTION proteger_auditoria_operacion();
