import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsInt, IsOptional, IsUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadosService } from '../empleados/empleados.service';
import { ScanQrDto } from './dto/scan-qr.dto';

export class ScanIndirectaDto {
  @IsUUID()
  uuidQr: string;

  @IsInt()
  actividadIndirectaId: number;

  @IsOptional()
  @IsInt()
  areaId?: number;
}

/**
 * Calcula diferencia en minutos entre dos strings HH:mm.
 * Si horaFin < horaInicio (cruce de medianoche) retorna 0.
 */
function calcularDuracion(horaInicio: string, horaFin: string): number {
  const [hI, mI] = horaInicio.split(':').map(Number);
  const [hF, mF] = horaFin.split(':').map(Number);
  const diff = (hF * 60 + mF) - (hI * 60 + mI);
  return diff > 0 ? diff : 0;
}

/**
 * CDMX: devuelve fecha (para @db.Date) y hora (HH:mm) correctas.
 */
function nowMxParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  const yyyy = get('year')!;
  const mm = get('month')!;
  const dd = get('day')!;
  const HH = get('hour')!;
  const MM = get('minute')!;

  const fechaStr = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD (CDMX)
  const horaStr = `${HH}:${MM}`;          // HH:mm (CDMX)

  // @db.Date: guardamos el “día CDMX” como medianoche UTC de ese día
  const fechaDate = new Date(`${fechaStr}T00:00:00.000Z`);

  return { fechaDate, horaStr };
}

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empleados: EmpleadosService,
  ) {}

  /**
   * QR → asigna actividad al empleado.
   *
   * Reglas:
   * - Si el mismo encargado re-escanea al mismo empleado en la misma área/subárea/modelo
   *   y la asignación activa sigue abierta → no hace nada, retorna la misma.
   * - Si hay asignación activa de otro encargado, o del mismo encargado en área diferente
   *   → cierra la anterior (registra horaFin + duracionMinutos) y abre una nueva.
   * - Siempre guarda encargadoId para trazabilidad.
   */
  async scan(dto: ScanQrDto, encargadoId: number) {
    const empleado = await this.empleados.findByQr(dto.uuidQr);
    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');
    if (!empleado.activo) throw new BadRequestException('Empleado inactivo');

    const { fechaDate, horaStr } = nowMxParts();

    const activa = await this.prisma.meroAsignacion.findFirst({
      where: { empleadoId: empleado.id, activa: true },
      orderBy: { createdAt: 'desc' },
    });

    if (activa) {
      const mismoEncargado = activa.encargadoId === encargadoId;
      const mismaActividad =
        activa.areaId === dto.areaId &&
        activa.subtareaId === dto.subtareaId &&
        activa.modeloId === dto.modeloId;

      // Re-escaneo idempotente: mismo encargado, misma actividad → retorna la activa
      if (mismoEncargado && mismaActividad) {
        return this.prisma.meroAsignacion.findUnique({
          where: { id: activa.id },
          include: { empleado: true, area: true, subtarea: true, modelo: true },
        });
      }

      // Cierra la asignación anterior calculando duración
      const duracionMinutos = calcularDuracion(activa.horaInicio, horaStr);
      await this.prisma.meroAsignacion.update({
        where: { id: activa.id },
        data: { activa: false, horaFin: horaStr, duracionMinutos },
      });
    }

    return this.prisma.meroAsignacion.create({
      data: {
        empleadoId: empleado.id,
        encargadoId,
        areaId: dto.areaId,
        subtareaId: dto.subtareaId,
        modeloId: dto.modeloId,
        tipo: 'DIRECTA',
        fecha: fechaDate,
        horaInicio: horaStr,
        horaFin: null,
        activa: true,
      },
      include: { empleado: true, area: true, subtarea: true, modelo: true },
    });
  }

  async finalizar(id: number) {
    const asg = await this.prisma.meroAsignacion.findUnique({ where: { id } });
    if (!asg) throw new NotFoundException('Asignación no encontrada');
    if (!asg.activa) throw new BadRequestException('La asignación ya está finalizada');

    const { horaStr } = nowMxParts();
    const duracionMinutos = calcularDuracion(asg.horaInicio, horaStr);

    return this.prisma.meroAsignacion.update({
      where: { id },
      data: { activa: false, horaFin: horaStr, duracionMinutos },
      include: { empleado: true, area: true, subtarea: true, modelo: true },
    });
  }

  async findActivas(areaId?: number) {
    const { fechaDate } = nowMxParts();
    return this.prisma.meroAsignacion.findMany({
      where: {
        activa: true,
        fecha: fechaDate,
        ...(areaId ? { areaId } : {}),
      },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmpleado(empleadoId: number, fecha?: string) {
    return this.prisma.meroAsignacion.findMany({
      where: {
        empleadoId,
        ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
      },
      include: {
        area: true,
        subtarea: true,
        modelo: true,
        capturas: true,
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Registra una actividad indirecta para un empleado (limpieza, capacitación, etc.).
   * No genera capturas ni se evalúa contra estándar.
   * Cierra la asignación activa anterior si existe.
   */
  async scanIndirecta(dto: ScanIndirectaDto, encargadoId: number) {
    const empleado = await this.empleados.findByQr(dto.uuidQr);
    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');
    if (!empleado.activo) throw new BadRequestException('Empleado inactivo');

    const actividad = await this.prisma.meroActividadIndirecta.findUnique({
      where: { id: dto.actividadIndirectaId },
    });
    if (!actividad || !actividad.activo) {
      throw new NotFoundException('Actividad indirecta no encontrada o inactiva');
    }

    const { fechaDate, horaStr } = nowMxParts();

    const activa = await this.prisma.meroAsignacion.findFirst({
      where: { empleadoId: empleado.id, activa: true },
      orderBy: { createdAt: 'desc' },
    });

    if (activa) {
      const duracionMinutos = calcularDuracion(activa.horaInicio, horaStr);
      await this.prisma.meroAsignacion.update({
        where: { id: activa.id },
        data: { activa: false, horaFin: horaStr, duracionMinutos },
      });
    }

    return this.prisma.meroAsignacion.create({
      data: {
        empleadoId: empleado.id,
        encargadoId,
        areaId: dto.areaId ?? null,
        subtareaId: null,
        modeloId: null,
        tipo: 'INDIRECTA',
        actividadIndirectaId: dto.actividadIndirectaId,
        fecha: fechaDate,
        horaInicio: horaStr,
        horaFin: null,
        activa: true,
      },
      include: {
        empleado: true,
        actividadIndirecta: true,
      },
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