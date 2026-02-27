import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { VitaSyncService } from './vita-sync.service';

/**
 * Servicio principal para la gestión de empleados en MERO.
 *
 * Responsabilidades:
 * - Consultar empleados almacenados en MERO.
 * - Enriquecer datos con información fresca desde VITA (ERP).
 * - Resolver empleados por QR.
 * - Generar imagen PNG del código QR asociado al empleado.
 *
 * Nota arquitectónica:
 * MERO mantiene su propia tabla `meroEmpleado`,
 * pero VITA es la fuente de verdad para datos laborales.
 */
@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService,      // Acceso a base de datos MERO
    private readonly vitaSync: VitaSyncService,  // Servicio para consultar datos en VITA (read-only)
  ) {}

  /**
   * Obtiene todos los empleados activos de MERO.
   *
   * Flujo:
   * 1. Se consultan empleados activos en BD local (MERO).
   * 2. Se consulta lista completa en VITA.
   * 3. Se construye un Map para búsqueda eficiente por ID.
   * 4. Se enriquecen los datos MERO con información fresca de VITA.
   *
   * Importante:
   * MERO no duplica toda la información laboral,
   * solo mantiene lo necesario y consulta VITA para datos actualizados.
   */
  async findAll() {
    // 1️⃣ Obtener empleados activos desde MERO
    const empleadosMero = await this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    // 2️⃣ Obtener datos frescos desde VITA
    const vitaEmpleados = await this.vitaSync.queryVitaEmpleados();

    // 3️⃣ Crear mapa para acceso rápido por ID_Vita
    const vitaMap = new Map(vitaEmpleados.map((v) => [v.ID_Empleado, v]));

    // 4️⃣ Enriquecer cada empleado MERO con datos de VITA
    return empleadosMero.map((emp) => {
      const vita = vitaMap.get(emp.idVita);

      return {
        ...emp,
        vita: vita
          ? {
              puesto: vita.Nombre_Puesto,
              area: vita.Nombre_Area,
              fechaIngreso: vita.Fecha_Ingreso,
              email: vita.Email_Corporativo,
            }
          : null,
      };
    });
  }

  /**
   * Obtiene un empleado específico por ID interno de MERO.
   *
   * Incluye:
   * - Últimas 10 asignaciones del empleado.
   * - Datos enriquecidos desde VITA.
   *
   * Lanza excepción 404 si no existe.
   */
  async findOne(id: number) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
      include: { asignaciones: { take: 10, orderBy: { fecha: 'desc' } } },
    });

    if (!empleado)
      throw new NotFoundException('Empleado no encontrado');

    // Consultar información detallada desde VITA
    const vita = await this.vitaSync.getVitaEmpleadoDetalle(
      empleado.idVita,
    );

    return {
      ...empleado,
      vita: vita
        ? {
            puesto: vita.Nombre_Puesto,
            area: vita.Nombre_Area,
            fechaIngreso: vita.Fecha_Ingreso,
            email: vita.Email_Corporativo,
            estatus: vita.ID_Estatus,
          }
        : null,
    };
  }

  /**
   * Busca un empleado utilizando su UUID de QR.
   *
   * Este método es usado cuando se escanea un QR.
   * El QR contiene únicamente el campo `uuidQr`.
   *
   * Seguridad actual:
   * - No hay expiración.
   * - No hay firma.
   * - Solo se valida existencia en BD.
   */
  async findByQr(uuidQr: string) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { uuidQr },
    });

    if (!empleado)
      throw new NotFoundException(
        'Empleado no encontrado por QR',
      );

    return empleado;
  }

  /**
   * Genera la imagen PNG del QR asociado a un empleado.
   *
   * Flujo:
   * 1. Busca empleado por ID interno.
   * 2. Toma su campo `uuidQr`.
   * 3. Genera imagen PNG con la librería `qrcode`.
   *
   * El QR contiene únicamente el UUID persistido en base de datos.
   *
   * Retorna:
   * - Buffer binario listo para enviarse como imagen HTTP.
   */
  async generateQrImage(id: number): Promise<Buffer> {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
    });

    if (!empleado)
      throw new NotFoundException('Empleado no encontrado');

    return QRCode.toBuffer(empleado.uuidQr, {
      type: 'png',
      width: 300,
      margin: 2,
    });
  }
}