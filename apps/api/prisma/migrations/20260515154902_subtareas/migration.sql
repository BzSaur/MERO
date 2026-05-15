-- DropForeignKey
ALTER TABLE "mero_asignaciones" DROP CONSTRAINT "mero_asignaciones_area_id_fkey";

-- DropForeignKey
ALTER TABLE "mero_asignaciones" DROP CONSTRAINT "mero_asignaciones_modelo_id_fkey";

-- DropForeignKey
ALTER TABLE "mero_asignaciones" DROP CONSTRAINT "mero_asignaciones_subtarea_id_fkey";

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "mero_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_subtarea_id_fkey" FOREIGN KEY ("subtarea_id") REFERENCES "mero_subtareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "mero_modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
