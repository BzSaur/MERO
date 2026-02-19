import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return empleado;
  }

  async findByQr(uuidQr: string) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { uuidQr },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');
    return empleado;
  }

  async generateQrImage(id: number): Promise<Buffer> {
    const empleado = await this.findOne(id);
    return QRCode.toBuffer(empleado.uuidQr, {
      type: 'png',
      width: 300,
      margin: 2,
    });
  }
}
