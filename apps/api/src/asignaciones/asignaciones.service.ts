import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadosService } from '../empleados/empleados.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empleados: EmpleadosService,
  ) {}

  /**
   * Flujo principal de escaneo QR:
   * 1. Buscar empleado por uuid_qr
   * 2. Si tiene asignación activa en OTRA área → cerrarla (hora_fin = ahora)
   * 3. Si tiene asignación activa en la MISMA área → reasignar subtarea/modelo
   * 4. Crear nueva asignación activa
   */
  async scan(dto: ScanQrDto) {
    const empleado = await this.empleados.findByQr(dto.uuidQr);
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0];
    const horaActual = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`;

    // Buscar asignación activa del empleado
    const activa = await this.prisma.meroAsignacion.findFirst({
      where: {
        empleadoId: empleado.id,
        fecha: new Date(fechaHoy),
        activa: true,
      },
    });

    if (activa) {
      // Cerrar asignación anterior
      await this.prisma.meroAsignacion.update({
        where: { id: activa.id },
        data: { activa: false, horaFin: horaActual },
      });
    }

    // Crear nueva asignación
    return this.prisma.meroAsignacion.create({
      data: {
        empleadoId: empleado.id,
        areaId: dto.areaId,
        subtareaId: dto.subtareaId,
        modeloId: dto.modeloId,
        fecha: new Date(fechaHoy),
        horaInicio: horaActual,
        activa: true,
      },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
      },
    });
  }

  async findActivas(areaId?: number) {
    const hoy = new Date().toISOString().split('T')[0];
    return this.prisma.meroAsignacion.findMany({
      where: {
        fecha: new Date(hoy),
        activa: true,
        ...(areaId ? { areaId } : {}),
      },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
      },
    });
  }

  async findByEmpleado(empleadoId: number, fecha?: string) {
    return this.prisma.meroAsignacion.findMany({
      where: {
        empleadoId,
        ...(fecha ? { fecha: new Date(fecha) } : {}),
      },
      include: {
        area: true,
        subtarea: true,
        modelo: true,
        capturas: true,
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: number) {
    const asignacion = await this.prisma.meroAsignacion.findUnique({
      where: { id },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
        capturas: true,
      },
    });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');
    return asignacion;
  }
}
