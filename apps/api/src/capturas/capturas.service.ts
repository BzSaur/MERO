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

  async create(dto: CreateCapturaDto, capturadoPor: number) {
    // Verificar que la asignación existe y está activa
    const asignacion = await this.prisma.meroAsignacion.findUnique({
      where: { id: dto.asignacionId },
    });

    if (!asignacion) {
      throw new NotFoundException('Asignación no encontrada');
    }

    // Validar que el slot horario es válido para el día
    const diaSemana = asignacion.fecha.getDay();
    // Convertir de JS (0=domingo) a ISO (7=domingo)
    const diaIso = diaSemana === 0 ? 7 : diaSemana;
    const slotsValidos = HORARIOS.getSlotsParaDia(diaIso);
    const slotValido = slotsValidos.some((s) => s.hora === dto.slotHora);

    if (!slotValido) {
      throw new BadRequestException(
        `El slot horario ${dto.slotHora} no es válido para este día`,
      );
    }

    // Verificar si ya existe una captura para este slot
    const existente = await this.prisma.meroCaptura.findFirst({
      where: {
        asignacionId: dto.asignacionId,
        slotHora: dto.slotHora,
      },
    });

    if (existente) {
      // Actualizar captura existente
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
