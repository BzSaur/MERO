import { Injectable, NotFoundException } from '@nestjs/common';
import { IsArray, IsDateString, IsInt, IsNumber, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstandarDto } from './dto/create-estandar.dto';
import { UpdateEstandarDto } from './dto/update-estandar.dto';

export class BulkUpsertEstandarDto {
  @IsInt()
  subtareaId: number;

  @IsArray()
  @IsInt({ each: true })
  modeloIds: number[];

  @IsNumber()
  @Min(0)
  piezasPorHora: number;

  @IsDateString()
  vigenteDesde: string;
}

@Injectable()
export class EstandaresService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateOnly(value: string | Date) {
    if (value instanceof Date) return value;
    return new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`);
  }

  create(dto: CreateEstandarDto) {
    return this.prisma.meroEstandar.create({
      data: {
        subtareaId: Number(dto.subtareaId),
        modeloId: Number(dto.modeloId),
        piezasPorHora: Number(dto.piezasPorHora),
        vigenteDesde: this.toDateOnly(dto.vigenteDesde),
      },
    });
  }

  findAll() {
    return this.prisma.meroEstandar.findMany({
      include: {
        subtarea: {
          include: {
            area: true,
          },
        },
        modelo: true,
      },
      orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number) {
    const estandar = await this.prisma.meroEstandar.findUnique({
      where: { id },
      include: {
        subtarea: {
          include: {
            area: true,
          },
        },
        modelo: true,
      },
    });

    if (!estandar) throw new NotFoundException('Estándar no encontrado');
    return estandar;
  }

  async update(id: number, dto: UpdateEstandarDto) {
    await this.findOne(id);

    return this.prisma.meroEstandar.update({
      where: { id },
      data: {
        ...(dto.piezasPorHora !== undefined
          ? { piezasPorHora: Number(dto.piezasPorHora) }
          : {}),
        ...(dto.vigenteDesde !== undefined
          ? { vigenteDesde: this.toDateOnly(dto.vigenteDesde) }
          : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.meroEstandar.delete({
      where: { id },
    });
  }

  async bulkUpsert(dto: BulkUpsertEstandarDto) {
    const subtareaId = Number(dto.subtareaId);
    const piezasPorHora = Number(dto.piezasPorHora);
    const vigenteDesde = this.toDateOnly(dto.vigenteDesde);
    const modeloIds = dto.modeloIds.map(Number);

    const results = await Promise.all(
      modeloIds.map(async (modeloId) => {
        const existing = await this.prisma.meroEstandar.findFirst({
          where: { subtareaId, modeloId },
          orderBy: { vigenteDesde: 'desc' },
        });

        if (existing) {
          return this.prisma.meroEstandar.update({
            where: { id: existing.id },
            data: { piezasPorHora, vigenteDesde },
          });
        }

        return this.prisma.meroEstandar.create({
          data: { subtareaId, modeloId, piezasPorHora, vigenteDesde },
        });
      }),
    );

    return { count: results.length, results };
  }

  async findVigente(subtareaId: number, modeloId: number) {
    const estandar = await this.prisma.meroEstandar.findFirst({
      where: {
        subtareaId,
        modeloId,
        vigenteDesde: { lte: new Date() },
      },
      orderBy: { vigenteDesde: 'desc' },
      include: {
        subtarea: {
          include: {
            area: true,
          },
        },
        modelo: true,
      },
    });

    if (!estandar) {
      throw new NotFoundException('No hay estándar vigente para esta combinación');
    }

    return estandar;
  }
}