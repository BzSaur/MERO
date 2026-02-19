import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    const exists = await this.prisma.meroUsuario.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.meroUsuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        rol: dto.rol,
        areaId: dto.areaId ?? null,
      },
      select: { id: true, nombre: true, email: true, rol: true, areaId: true },
    });
  }

  findAll() {
    return this.prisma.meroUsuario.findMany({
      select: { id: true, nombre: true, email: true, rol: true, areaId: true, createdAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.meroUsuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, email: true, rol: true, areaId: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, dto: UpdateUsuarioDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.nombre) data.nombre = dto.nombre;
    if (dto.email) data.email = dto.email;
    if (dto.rol) data.rol = dto.rol;
    if (dto.areaId !== undefined) data.areaId = dto.areaId;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.meroUsuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, areaId: true, createdAt: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.meroUsuario.delete({ where: { id } });
    return { deleted: true };
  }
}
