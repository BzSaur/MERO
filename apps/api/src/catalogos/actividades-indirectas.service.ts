import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActividadIndirectaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}

export class UpdateActividadIndirectaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

@Injectable()
export class ActividadesIndirectasService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateActividadIndirectaDto, createdBy?: number) {
    return this.prisma.meroActividadIndirecta.create({
      data: { ...dto, createdBy },
    });
  }

  findAll() {
    return this.prisma.meroActividadIndirecta.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  findAllIncludeInactivas() {
    return this.prisma.meroActividadIndirecta.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const act = await this.prisma.meroActividadIndirecta.findUnique({ where: { id } });
    if (!act) throw new NotFoundException('Actividad indirecta no encontrada');
    return act;
  }

  async update(id: number, dto: UpdateActividadIndirectaDto) {
    await this.findOne(id);
    return this.prisma.meroActividadIndirecta.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.meroActividadIndirecta.update({
      where: { id },
      data: { activo: false },
    });
  }
}
