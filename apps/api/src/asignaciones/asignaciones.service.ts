import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadosService } from '../empleados/empleados.service';
import { ScanQrDto } from './dto/scan-qr.dto';

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
   * QR → asigna:
   * - cierra cualquier asignación activa previa (sin importar fecha)
   * - crea nueva con fecha/hora CDMX
   */
  async scan(dto: ScanQrDto) {
    const empleado = await this.empleados.findByQr(dto.uuidQr);
    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');
    if (!empleado.activo) throw new BadRequestException('Empleado inactivo');

    const { fechaDate, horaStr } = nowMxParts();

    // Cierra la última activa (sin filtrar por fecha)
    const activa = await this.prisma.meroAsignacion.findFirst({
      where: { empleadoId: empleado.id, activa: true },
      orderBy: { createdAt: 'desc' },
    });

    if (activa) {
      await this.prisma.meroAsignacion.update({
        where: { id: activa.id },
        data: { activa: false, horaFin: horaStr },
      });
    }

    // Crea nueva asignación activa
    return this.prisma.meroAsignacion.create({
      data: {
        empleadoId: empleado.id,
        areaId: dto.areaId,
        subtareaId: dto.subtareaId,
        modeloId: dto.modeloId,
        fecha: fechaDate,
        horaInicio: horaStr,
        horaFin: null,
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

  async finalizar(id: number) {
    const asg = await this.prisma.meroAsignacion.findUnique({ where: { id } });
    if (!asg) throw new NotFoundException('Asignación no encontrada');
    if (!asg.activa) throw new BadRequestException('La asignación ya está finalizada');

    const { horaStr } = nowMxParts();

    return this.prisma.meroAsignacion.update({
      where: { id },
      data: { activa: false, horaFin: horaStr },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
      },
    });
  }

  async findActivas(areaId?: number) {
    const { fechaDate } = nowMxParts();

    return this.prisma.meroAsignacion.findMany({
      where: {
        fecha: fechaDate,
        activa: true,
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