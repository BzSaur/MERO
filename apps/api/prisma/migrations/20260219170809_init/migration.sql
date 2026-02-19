-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'ENCARGADO', 'CONSULTOR');

-- CreateTable
CREATE TABLE "mero_areas" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "mero_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_subtareas" (
    "id" SERIAL NOT NULL,
    "area_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "mero_subtareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_modelos" (
    "id" SERIAL NOT NULL,
    "nombre_sku" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "mero_modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_estandares" (
    "id" SERIAL NOT NULL,
    "subtarea_id" INTEGER NOT NULL,
    "modelo_id" INTEGER NOT NULL,
    "piezas_por_hora" DOUBLE PRECISION NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "mero_estandares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_empleados" (
    "id" SERIAL NOT NULL,
    "id_vita" INTEGER NOT NULL,
    "uuid_qr" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "apellidos" VARCHAR(200),
    "id_area_vita" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mero_empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_usuarios" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "Rol" NOT NULL,
    "area_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mero_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_asignaciones" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "area_id" INTEGER NOT NULL,
    "subtarea_id" INTEGER NOT NULL,
    "modelo_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mero_asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_capturas" (
    "id" SERIAL NOT NULL,
    "asignacion_id" INTEGER NOT NULL,
    "slot_hora" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "capturado_por" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mero_capturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mero_auditoria" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "accion" VARCHAR(20) NOT NULL,
    "tabla" VARCHAR(50) NOT NULL,
    "registro_id" INTEGER NOT NULL,
    "datos_antes" JSONB,
    "datos_despues" JSONB,
    "ip" VARCHAR(45) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mero_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_estandar_vigente" ON "mero_estandares"("subtarea_id", "modelo_id", "vigente_desde" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mero_empleados_id_vita_key" ON "mero_empleados"("id_vita");

-- CreateIndex
CREATE UNIQUE INDEX "mero_empleados_uuid_qr_key" ON "mero_empleados"("uuid_qr");

-- CreateIndex
CREATE UNIQUE INDEX "mero_usuarios_email_key" ON "mero_usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_asignacion_empleado_fecha" ON "mero_asignaciones"("empleado_id", "fecha", "activa");

-- CreateIndex
CREATE INDEX "idx_captura_asignacion_slot" ON "mero_capturas"("asignacion_id", "slot_hora");

-- CreateIndex
CREATE INDEX "idx_auditoria_timestamp" ON "mero_auditoria"("timestamp" DESC, "usuario_id");

-- AddForeignKey
ALTER TABLE "mero_subtareas" ADD CONSTRAINT "mero_subtareas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "mero_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_estandares" ADD CONSTRAINT "mero_estandares_subtarea_id_fkey" FOREIGN KEY ("subtarea_id") REFERENCES "mero_subtareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_estandares" ADD CONSTRAINT "mero_estandares_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "mero_modelos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_usuarios" ADD CONSTRAINT "mero_usuarios_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "mero_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "mero_empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "mero_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_subtarea_id_fkey" FOREIGN KEY ("subtarea_id") REFERENCES "mero_subtareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_asignaciones" ADD CONSTRAINT "mero_asignaciones_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "mero_modelos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mero_capturas" ADD CONSTRAINT "mero_capturas_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "mero_asignaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
