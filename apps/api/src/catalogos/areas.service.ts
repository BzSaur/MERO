import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAreaDto) {
    return this.prisma.meroArea.create({ data: dto });
  }

  findAll() {
    return this.prisma.meroArea.findMany({
      where: { activo: true },
      include: { subtareas: { where: { activo: true } } },
    });
  }

  async findOne(id: number) {
    const area = await this.prisma.meroArea.findUnique({
      where: { id },
      include: { subtareas: true },
    });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }

  async update(id: number, dto: UpdateAreaDto) {
    await this.findOne(id);
    return this.prisma.meroArea.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.meroArea.update({
      where: { id },
      data: { activo: false },
    });
  }
}
