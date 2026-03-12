import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCapturaDto } from './dto/create-captura.dto';
import { HORARIOS } from '@mero/shared';

@Injectable()
export class CapturasService {
  constructor(private readonly prisma: PrismaService) {}

  private getMexicoNowParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(date);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';

    const isoMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

    return {
      hour,
      minute,
      isoDay: isoMap[weekday] ?? 0,
    };
  }

  async create(dto: CreateCapturaDto, capturadoPor: number) {
    const asignacion = await this.prisma.meroAsignacion.findUnique({
      where: { id: dto.asignacionId },
    });

    if (!asignacion) {
      throw new NotFoundException('Asignación no encontrada');
    }

    const diaSemana = asignacion.fecha.getDay();
    const diaIso = diaSemana === 0 ? 7 : diaSemana;
    const slotsValidos = HORARIOS.getSlotsParaDia(diaIso);
    const slotValido = slotsValidos.some((s: { hora: number }) => s.hora === dto.slotHora);

    if (!slotValido) {
      throw new BadRequestException(
        `El slot horario ${dto.slotHora} no es válido para este día`,
      );
    }

    const { hour: horaActualMexico } = this.getMexicoNowParts();

    const horasPermitidas: number[] = [];

    // El slot anterior sigue disponible durante toda la hora siguiente
    if (slotsValidos.some((s: { hora: number }) => s.hora === (horaActualMexico - 1))) {
      horasPermitidas.push(horaActualMexico - 1);
    }

    // El slot actual también se puede capturar si es válido
    if (slotsValidos.some((s: { hora: number }) => s.hora === horaActualMexico)) {
      horasPermitidas.push(horaActualMexico);
    }

    if (!horasPermitidas.includes(dto.slotHora)) {
      if (!horasPermitidas.length) {
        throw new BadRequestException(
          'En este momento no hay ningún slot disponible para captura',
        );
      }

      throw new BadRequestException(
        `Solo puedes capturar estos slots actualmente: ${horasPermitidas
          .map((h) => `${h}:00 - ${h + 1}:00`)
          .join(', ')}`,
      );
    }

    const existente = await this.prisma.meroCaptura.findFirst({
      where: {
        asignacionId: dto.asignacionId,
        slotHora: dto.slotHora,
      },
    });

    if (existente) {
      return this.prisma.meroCaptura.update({
        where: { id: existente.id },
        data: { cantidad: dto.cantidad, capturadoPor },
      });
    }

    return this.prisma.meroCaptura.create({
      data: {
        asignacionId: dto.asignacionId,
        slotHora: dto.slotHora,
        cantidad: dto.cantidad,
        capturadoPor,
      },
    });
  }

  findByAsignacion(asignacionId: number) {
    return this.prisma.meroCaptura.findMany({
      where: { asignacionId },
      orderBy: { slotHora: 'asc' },
    });
  }
}