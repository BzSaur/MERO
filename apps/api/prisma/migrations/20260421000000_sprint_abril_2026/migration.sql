-- Sprint Abril 2026 — Migración consolidada (Fases 1, 2 y 3)
-- Cubre: multi-registro, cierre automático QR, actividades indirectas,
--        rechazos por pieza, feedback captura, resumen bimestral.

-- ─── 1. Enum TipoAsignacion ───
CREATE TYPE "TipoAsignacion" AS ENUM ('DIRECTA', 'INDIRECTA');

-- ─── 2. Catálogo de actividades indirectas ───
CREATE TABLE "mero_actividades_indirectas" (
    "id"          SERIAL PRIMARY KEY,
    "nombre"      VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "created_by"  INTEGER
);

-- ─── 3. Nuevas columnas en mero_asignaciones ───
-- area_id, subtarea_id, modelo_id pasan a nullable para soportar indirectas
ALTER TABLE "mero_asignaciones"
    ALTER COLUMN "area_id"     DROP NOT NULL,
    ALTER COLUMN "subtarea_id" DROP NOT NULL,
    ALTER COLUMN "modelo_id"   DROP NOT NULL;

ALTER TABLE "mero_asignaciones"
    ADD COLUMN "encargado_id"           INTEGER,
    ADD COLUMN "tipo"                   "TipoAsignacion" NOT NULL DEFAULT 'DIRECTA',
    ADD COLUMN "actividad_indirecta_id" INTEGER,
    ADD COLUMN "duracion_minutos"       INTEGER;

-- FK encargado → mero_usuarios
ALTER TABLE "mero_asignaciones"
    ADD CONSTRAINT "mero_asignaciones_encargado_id_fkey"
    FOREIGN KEY ("encargado_id") REFERENCES "mero_usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- FK actividad indirecta → mero_actividades_indirectas
ALTER TABLE "mero_asignaciones"
    ADD CONSTRAINT "mero_asignaciones_actividad_indirecta_id_fkey"
    FOREIGN KEY ("actividad_indirecta_id") REFERENCES "mero_actividades_indirectas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices nuevos en mero_asignaciones
CREATE INDEX "idx_asignacion_fecha"
    ON "mero_asignaciones"("fecha");

CREATE INDEX "idx_asignacion_encargado_fecha"
    ON "mero_asignaciones"("encargado_id", "fecha");

-- ─── 4. Nuevas columnas en mero_capturas ───
-- La relación capturado_por → mero_usuarios ya existe como columna INT;
-- solo añadimos el FK formal y el índice para limpieza.

ALTER TABLE "mero_capturas"
    ADD CONSTRAINT "mero_capturas_capturado_por_fkey"
    FOREIGN KEY ("capturado_por") REFERENCES "mero_usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_captura_created_at"
    ON "mero_capturas"("created_at" DESC);

-- ─── 5. Tabla de rechazos ───
CREATE TABLE "mero_rechazos" (
    "id"             SERIAL PRIMARY KEY,
    "captura_id"     INTEGER NOT NULL,
    "cantidad"       INTEGER NOT NULL,
    "motivo"         VARCHAR(255),
    "registrado_por" INTEGER NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mero_rechazos_captura_id_fkey"
        FOREIGN KEY ("captura_id") REFERENCES "mero_capturas"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "mero_rechazos_registrado_por_fkey"
        FOREIGN KEY ("registrado_por") REFERENCES "mero_usuarios"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_rechazo_captura"
    ON "mero_rechazos"("captura_id");

-- ─── 6. Tabla resumen bimestral (archivo histórico) ───
CREATE TABLE "mero_resumenes_bimestrales" (
    "id"                SERIAL PRIMARY KEY,
    "periodo_inicio"    DATE NOT NULL,
    "periodo_fin"       DATE NOT NULL,
    "empleado_id"       INTEGER NOT NULL,
    "area_id"           INTEGER NOT NULL,
    "subtarea_id"       INTEGER NOT NULL,
    "modelo_id"         INTEGER NOT NULL,
    "total_piezas"      INTEGER NOT NULL,
    "total_rechazos"    INTEGER NOT NULL DEFAULT 0,
    "minutos_indirectos" INTEGER NOT NULL DEFAULT 0,
    "horas_activas"     DOUBLE PRECISION NOT NULL,
    "empleados_count"   INTEGER NOT NULL,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mero_resumenes_bimestrales_empleado_id_fkey"
        FOREIGN KEY ("empleado_id") REFERENCES "mero_empleados"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "mero_resumenes_bimestrales_area_id_fkey"
        FOREIGN KEY ("area_id") REFERENCES "mero_areas"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "mero_resumenes_bimestrales_subtarea_id_fkey"
        FOREIGN KEY ("subtarea_id") REFERENCES "mero_subtareas"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "mero_resumenes_bimestrales_modelo_id_fkey"
        FOREIGN KEY ("modelo_id") REFERENCES "mero_modelos"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_resumen_periodo_area"
    ON "mero_resumenes_bimestrales"("periodo_inicio", "area_id");

CREATE INDEX "idx_resumen_periodo_empleado"
    ON "mero_resumenes_bimestrales"("periodo_inicio", "empleado_id");
