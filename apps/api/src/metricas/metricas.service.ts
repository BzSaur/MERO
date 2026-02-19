import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstandaresService } from '../catalogos/estandares.service';

@Injectable()
export class MetricasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estandares: EstandaresService,
  ) {}

  async getMetricasHora(fecha: string, areaId?: number) {
    const asignaciones = await this.prisma.meroAsignacion.findMany({
      where: {
        fecha: new Date(fecha),
        ...(areaId ? { areaId } : {}),
      },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
        capturas: { orderBy: { slotHora: 'asc' } },
      },
    });

    const metricas = [];

    for (const asignacion of asignaciones) {
      let estandarPiezas = 0;
      try {
        const estandar = await this.estandares.findVigente(
          asignacion.subtareaId,
          asignacion.modeloId,
        );
        estandarPiezas = estandar.piezasPorHora;
      } catch {
        // Sin estándar vigente, eficiencia queda en 0
      }

      for (const captura of asignacion.capturas) {
        const eficiencia =
          estandarPiezas > 0
            ? Math.round((captura.cantidad / estandarPiezas) * 100 * 100) / 100
            : 0;

        metricas.push({
          asignacionId: asignacion.id,
          empleado: asignacion.empleado.nombre,
          area: asignacion.area.nombre,
          subtarea: asignacion.subtarea.nombre,
          modelo: asignacion.modelo.nombreSku,
          slotHora: captura.slotHora,
          cantidad: captura.cantidad,
          estandar: estandarPiezas,
          eficienciaPct: eficiencia,
        });
      }
    }

    return metricas;
  }

  async getMetricasDia(fecha: string, areaId?: number) {
    const metricas = await this.getMetricasHora(fecha, areaId);

    // Agrupar por área + subtarea + modelo
    const agrupado = new Map<
      string,
      {
        areaId: number;
        area: string;
        subtarea: string;
        modelo: string;
        totalPiezas: number;
        sumEficiencia: number;
        countSlots: number;
        empleados: Set<number>;
      }
    >();

    for (const m of metricas) {
      const key = `${m.area}-${m.subtarea}-${m.modelo}`;
      const entry = agrupado.get(key) ?? {
        areaId: 0,
        area: m.area,
        subtarea: m.subtarea,
        modelo: m.modelo,
        totalPiezas: 0,
        sumEficiencia: 0,
        countSlots: 0,
        empleados: new Set<number>(),
      };

      entry.totalPiezas += m.cantidad;
      entry.sumEficiencia += m.eficienciaPct;
      entry.countSlots += 1;
      entry.empleados.add(m.asignacionId);
      agrupado.set(key, entry);
    }

    return Array.from(agrupado.values()).map((g) => ({
      fecha,
      area: g.area,
      subtarea: g.subtarea,
      modelo: g.modelo,
      totalPiezas: g.totalPiezas,
      promedioEficiencia:
        g.countSlots > 0
          ? Math.round((g.sumEficiencia / g.countSlots) * 100) / 100
          : 0,
      empleadosCount: g.empleados.size,
    }));
  }

  async getHistorico(
    desde: string,
    hasta: string,
    areaId?: number,
    subtareaId?: number,
    modeloId?: number,
  ) {
    const asignaciones = await this.prisma.meroAsignacion.findMany({
      where: {
        fecha: { gte: new Date(desde), lte: new Date(hasta) },
        ...(areaId ? { areaId } : {}),
        ...(subtareaId ? { subtareaId } : {}),
        ...(modeloId ? { modeloId } : {}),
      },
      include: {
        empleado: true,
        area: true,
        subtarea: true,
        modelo: true,
        capturas: true,
      },
      orderBy: { fecha: 'asc' },
    });

    return asignaciones;
  }
}
