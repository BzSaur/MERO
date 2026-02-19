import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubtareaDto } from './dto/create-subtarea.dto';
import { UpdateSubtareaDto } from './dto/update-subtarea.dto';

@Injectable()
export class SubtareasService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSubtareaDto) {
    return this.prisma.meroSubtarea.create({ data: dto });
  }

  findAll() {
    return this.prisma.meroSubtarea.findMany({
      where: { activo: true },
      include: { area: true },
    });
  }

  async findOne(id: number) {
    const subtarea = await this.prisma.meroSubtarea.findUnique({
      where: { id },
      include: { area: true },
    });
    if (!subtarea) throw new NotFoundException('Subtarea no encontrada');
    return subtarea;
  }

  async update(id: number, dto: UpdateSubtareaDto) {
    await this.findOne(id);
    return this.prisma.meroSubtarea.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.meroSubtarea.update({
      where: { id },
      data: { activo: false },
    });
  }
}
