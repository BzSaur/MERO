import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstandarDto } from './dto/create-estandar.dto';

@Injectable()
export class EstandaresService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEstandarDto) {
    return this.prisma.meroEstandar.create({ data: dto });
  }

  findAll() {
    return this.prisma.meroEstandar.findMany({
      include: { subtarea: true, modelo: true },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  async findOne(id: number) {
    const estandar = await this.prisma.meroEstandar.findUnique({
      where: { id },
      include: { subtarea: true, modelo: true },
    });
    if (!estandar) throw new NotFoundException('Estándar no encontrado');
    return estandar;
  }

  async findVigente(subtareaId: number, modeloId: number) {
    const estandar = await this.prisma.meroEstandar.findFirst({
      where: {
        subtareaId,
        modeloId,
        vigenteDesde: { lte: new Date() },
      },
      orderBy: { vigenteDesde: 'desc' },
    });
    if (!estandar) {
      throw new NotFoundException('No hay estándar vigente para esta combinación');
    }
    return estandar;
  }
}
