import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { VitaSyncService } from './vita-sync.service';

@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vitaSync: VitaSyncService,
  ) {}

  /**
   * Lista todos los empleados activos de MERO,
   * enriquecidos con datos frescos de VITA (puesto, area).
   */
  async findAll() {
    const empleadosMero = await this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    // Leer datos frescos de VITA para enriquecer
    const vitaEmpleados = await this.vitaSync.queryVitaEmpleados();
    const vitaMap = new Map(vitaEmpleados.map((v) => [v.ID_Empleado, v]));

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
   * Obtiene un empleado por ID de MERO, con datos completos de VITA.
   */
  async findOne(id: number) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
      include: { asignaciones: { take: 10, orderBy: { fecha: 'desc' } } },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    // Enriquecer con datos frescos de VITA
    const vita = await this.vitaSync.getVitaEmpleadoDetalle(empleado.idVita);

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

  async findByQr(uuidQr: string) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { uuidQr },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');
    return empleado;
  }

  async generateQrImage(id: number): Promise<Buffer> {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return QRCode.toBuffer(empleado.uuidQr, {
      type: 'png',
      width: 300,
      margin: 2,
    });
  }
}
