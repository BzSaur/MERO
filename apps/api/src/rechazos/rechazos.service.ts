import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateRechazoDto {
  @IsInt()
  capturaId: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}

@Injectable()
export class RechazosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRechazoDto, registradoPor: number) {
    const captura = await this.prisma.meroCaptura.findUnique({
      where: { id: dto.capturaId },
      include: {
        rechazos: true,
      },
    });

    if (!captura) throw new NotFoundException('Captura no encontrada');

    const yaRechazados = captura.rechazos.reduce((sum, r) => sum + r.cantidad, 0);
    const disponibles = captura.cantidad - yaRechazados;

    if (dto.cantidad > disponibles) {
      throw new BadRequestException(
        `Solo puedes rechazar ${disponibles} piezas (producidas: ${captura.cantidad}, ya rechazadas: ${yaRechazados})`,
      );
    }

    return this.prisma.meroRechazo.create({
      data: {
        capturaId: dto.capturaId,
        cantidad: dto.cantidad,
        motivo: dto.motivo,
        registradoPor,
      },
      include: {
        encargado: { select: { id: true, nombre: true } },
      },
    });
  }

  findByCaptura(capturaId: number) {
    return this.prisma.meroRechazo.findMany({
      where: { capturaId },
      include: {
        encargado: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByAsignacion(asignacionId: number) {
    return this.prisma.meroRechazo.findMany({
      where: {
        captura: { asignacionId },
      },
      include: {
        captura: { select: { id: true, slotHora: true, cantidad: true } },
        encargado: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
