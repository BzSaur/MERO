docker exec -it mero-db sh -lc 'cat > /tmp/seed_estandares.sql <<'"'"'SQL'"'"'
BEGIN;

-- =========================
-- CONFIG
-- =========================
-- Puedes cambiar la fecha si quieres “vigencia” fija:
--   CURRENT_DATE  -> hoy
--   DATE '\''2026-03-05'\'' -> fecha fija
WITH cfg AS (
  SELECT CURRENT_DATE::date AS vig
)

-- =========================
-- HELPERS (subtareas y modelos por nombre)
-- =========================
, st AS (
  SELECT id, nombre FROM mero_subtareas
)
, mo AS (
  SELECT id, nombre FROM mero_modelos
)

-- =========================
-- LIMPIA SOLO LO QUE VAMOS A CARGAR (por seguridad)
-- =========================
DELETE FROM mero_estandares e
USING st, mo
WHERE e.subtarea_id = st.id
  AND e.modelo_id   = mo.id
  AND st.nombre IN (
    '\''Test funcional'\'',
    '\''Test inicial'\'',
    '\''Quitar tapa'\'',
    '\''Desensamble'\'',
    '\''Escaneo'\'',
    '\''N1'\''  -- Reparación N1
  );

-- =========================
-- INSERTS
-- =========================

-- Test funcional: 80 pz/hr (para TODOS los modelos)
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 80, cfg.vig
FROM st
CROSS JOIN mo
CROSS JOIN cfg
WHERE st.nombre = '\''Test funcional'\'';

-- Test inicial: 40 pz/hr (para TODOS los modelos)
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 40, cfg.vig
FROM st
CROSS JOIN mo
CROSS JOIN cfg
WHERE st.nombre = '\''Test inicial'\'';

-- Quitar tapa: 40 pz/hr (para TODOS los modelos)
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 40, cfg.vig
FROM st
CROSS JOIN mo
CROSS JOIN cfg
WHERE st.nombre = '\''Quitar tapa'\'';

-- Escaneo: 100 pz/hr (para TODOS los modelos)
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 100, cfg.vig
FROM st
CROSS JOIN mo
CROSS JOIN cfg
WHERE st.nombre = '\''Escaneo'\'';

-- Reparación N1: 15 pz/hr (para TODOS los modelos)
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 15, cfg.vig
FROM st
CROSS JOIN mo
CROSS JOIN cfg
WHERE st.nombre = '\''N1'\'';

-- Desensamble:
-- FiberHome: 30 pz/hr
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 30, cfg.vig
FROM st
JOIN mo ON mo.nombre = '\''FiberHome'\''
CROSS JOIN cfg
WHERE st.nombre = '\''Desensamble'\'';

-- Desensamble:
-- Big, Small, X6: 40 pz/hr
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 40, cfg.vig
FROM st
JOIN mo ON mo.nombre IN ('\''Big'\'','\''Small'\'','\''X6'\'')
CROSS JOIN cfg
WHERE st.nombre = '\''Desensamble'\'';

-- Desensamble:
-- ZTE: 20 pz/hr
INSERT INTO mero_estandares (subtarea_id, modelo_id, piezas_por_hora, vigente_desde)
SELECT st.id, mo.id, 20, cfg.vig
FROM st
JOIN mo ON mo.nombre = '\''ZTE'\''
CROSS JOIN cfg
WHERE st.nombre = '\''Desensamble'\'';

COMMIT;

-- Verifica lo cargado (muestra top)
SELECT st.nombre AS subtarea, mo.nombre AS modelo, e.piezas_por_hora, e.vigente_desde
FROM mero_estandares e
JOIN mero_subtareas st ON st.id = e.subtarea_id
JOIN mero_modelos mo   ON mo.id = e.modelo_id
WHERE st.nombre IN (
  '\''Test funcional'\'','\''Test inicial'\'','\''Quitar tapa'\'','\''Desensamble'\'','\''Escaneo'\'','\''N1'\''
)
ORDER BY st.nombre, mo.nombre, e.vigente_desde DESC;
SQL
psql -U mero -d mero_db -f /tmp/seed_estandares.sql'