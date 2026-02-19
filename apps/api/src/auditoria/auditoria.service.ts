import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuditoriaFilters {
  desde?: string;
  hasta?: string;
  usuarioId?: number;
  tabla?: string;
  limit: number;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    usuarioId: number;
    accion: string;
    tabla: string;
    registroId: number;
    datosAntes?: unknown;
    datosDespues?: unknown;
    ip: string;
  }) {
    return this.prisma.meroAuditoria.create({
      data: {
        usuarioId: params.usuarioId,
        accion: params.accion,
        tabla: params.tabla,
        registroId: params.registroId,
        datosAntes: params.datosAntes ?? undefined,
        datosDespues: params.datosDespues ?? undefined,
        ip: params.ip,
      },
    });
  }

  findAll(filters: AuditoriaFilters) {
    return this.prisma.meroAuditoria.findMany({
      where: {
        ...(filters.desde || filters.hasta
          ? {
              timestamp: {
                ...(filters.desde ? { gte: new Date(filters.desde) } : {}),
                ...(filters.hasta ? { lte: new Date(filters.hasta) } : {}),
              },
            }
          : {}),
        ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
        ...(filters.tabla ? { tabla: filters.tabla } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit,
    });
  }
}
