import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModeloDto } from './dto/create-modelo.dto';
import { UpdateModeloDto } from './dto/update-modelo.dto';

@Injectable()
export class ModelosService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateModeloDto) {
    return this.prisma.meroModelo.create({ data: dto });
  }

  findAll() {
    return this.prisma.meroModelo.findMany({ where: { activo: true } });
  }

  async findOne(id: number) {
    const modelo = await this.prisma.meroModelo.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException('Modelo no encontrado');
    return modelo;
  }

  async update(id: number, dto: UpdateModeloDto) {
    await this.findOne(id);
    return this.prisma.meroModelo.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.meroModelo.update({
      where: { id },
      data: { activo: false },
    });
  }
}
