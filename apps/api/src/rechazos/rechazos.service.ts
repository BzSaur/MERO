import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { MetricasSseService } from '../metricas/metricas-sse.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: MetricasSseService,
  ) {}

  async create(dto: CreateRechazoDto, registradoPor: number) {
    const captura = await this.prisma.meroCaptura.findUnique({
      where: { id: dto.capturaId },
      include: {
        asignacion: {
          include: {
            capturas: {
              include: { rechazos: true },
            },
          },
        },
      },
    });

    if (!captura) throw new NotFoundException('Captura no encontrada');

    const capturasAsg = captura.asignacion.capturas;
    const totalCapturado = capturasAsg.reduce((sum, c) => sum + c.cantidad, 0);
    const totalRechazado = capturasAsg.reduce(
      (sum, c) => sum + c.rechazos.reduce((s, r) => s + r.cantidad, 0),
      0,
    );
    const disponibles = totalCapturado - totalRechazado;

    if (dto.cantidad > disponibles) {
      throw new BadRequestException(
        `Solo puedes rechazar ${disponibles} piezas (capturado: ${totalCapturado}, ya rechazado: ${totalRechazado})`,
      );
    }

    const rechazo = await this.prisma.meroRechazo.create({
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

    this.sse.emit({
      type: 'captura',
      data: {
        asignacionId: captura.asignacionId,
        capturaId: captura.id,
        slotHora: captura.slotHora,
        totalCapturado,
        totalRechazado: totalRechazado + dto.cantidad,
        totalNeto: totalCapturado - totalRechazado - dto.cantidad,
      },
    });

    return rechazo;
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
