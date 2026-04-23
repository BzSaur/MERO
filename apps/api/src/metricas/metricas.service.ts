import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstandaresService } from '../catalogos/estandares.service';
import { VitaSyncService } from '../empleados/vita-sync.service';

@Injectable()
export class MetricasService {
  // Reglas fijas (simples)
  private static readonly TENURE_DAYS = 30;
  private static readonly NEWBIE_FACTOR = 0.6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly estandares: EstandaresService,
    private readonly vitaSync: VitaSyncService,
  ) {}

  private startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private diffDays(a: Date, b: Date) {
    const A = this.startOfDay(a).getTime();
    const B = this.startOfDay(b).getTime();
    return Math.floor((A - B) / (1000 * 60 * 60 * 24));
  }

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
      // Excluir indirectas de métricas productivas
      if (asignacion.tipo === 'INDIRECTA') continue;

      // 1) estándar base (ya existe)
      let estandarBase = 0;
      try {
        const estandar = await this.estandares.findVigente(
          asignacion.subtareaId!,
          asignacion.modeloId!,
        );
        estandarBase = estandar.piezasPorHora;
      } catch {
        // sin estándar vigente
      }

      // 2) antigüedad desde VITA (sin caché, como pediste)
      let diasAntiguedad: number | null = null;
      let tipoEstandar: 'NUEVO' | 'NORMAL' | 'DESCONOCIDO' = 'DESCONOCIDO';

      try {
        const vita = await this.vitaSync.getVitaEmpleadoDetalle(
          asignacion.empleado.idVita,
        );

        if (vita?.Fecha_Ingreso) {
          diasAntiguedad = this.diffDays(asignacion.fecha, new Date(vita.Fecha_Ingreso));
          if (diasAntiguedad < 0) diasAntiguedad = 0;

          tipoEstandar =
            diasAntiguedad < MetricasService.TENURE_DAYS ? 'NUEVO' : 'NORMAL';
        }
      } catch {
        // si VITA falla, dejamos DESCONOCIDO y aplicamos estándar base sin factor
      }

      // 3) estándar aplicado = base * factor (solo si es NUEVO)
      const factorAplicado =
        tipoEstandar === 'NUEVO' ? MetricasService.NEWBIE_FACTOR : 1;

      const estandarAplicado =
        estandarBase > 0 ? Math.max(1, Math.round(estandarBase * factorAplicado)) : 0;

      // 4) por hora (capturas)
      for (const captura of asignacion.capturas) {
        const eficiencia =
          estandarAplicado > 0
            ? Math.round((captura.cantidad / estandarAplicado) * 100 * 100) / 100
            : 0;

        metricas.push({
          asignacionId: asignacion.id,
          empleado: asignacion.empleado.nombre,
          area: asignacion.area?.nombre ?? '—',
          subtarea: asignacion.subtarea?.nombre ?? '—',
          modelo: asignacion.modelo?.nombreSku ?? '—',
          slotHora: captura.slotHora,
          cantidad: captura.cantidad,

          // 👇 antes era el base; ahora es el aplicado (con 0.60 si NUEVO)
          estandar: estandarAplicado,
          eficienciaPct: eficiencia,

          // 👇 extras (no rompen front si no los usa)
          estandarBase,
          factorAplicado,
          diasAntiguedad,
          tipoEstandar,
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
        tipo: 'DIRECTA',
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
        capturas: {
          include: {
            rechazos: true,
          },
          orderBy: { slotHora: 'asc' },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    // Aplanar a nivel captura con nombres resueltos y eficiencia calculada
    const rows: object[] = [];

    for (const asignacion of asignaciones) {
      let estandarBase = 0;
      try {
        const estandar = await this.estandares.findVigente(
          asignacion.subtareaId!,
          asignacion.modeloId!,
        );
        estandarBase = estandar.piezasPorHora;
      } catch { /* sin estándar */ }

      for (const captura of asignacion.capturas) {
        const totalRechazados = captura.rechazos.reduce((s, r) => s + r.cantidad, 0);
        const cantidadNeta = captura.cantidad - totalRechazados;
        const eficiencia = estandarBase > 0
          ? Math.round((cantidadNeta / estandarBase) * 100 * 100) / 100
          : null;

        rows.push({
          fecha: asignacion.fecha.toISOString().slice(0, 10),
          slotHora: captura.slotHora,
          areaNombre: asignacion.area?.nombre ?? '—',
          subtareaNombre: asignacion.subtarea?.nombre ?? '—',
          modeloNombre: asignacion.modelo?.nombreSku ?? '—',
          empleadoNombre: `${asignacion.empleado.nombre} ${asignacion.empleado.apellidos ?? ''}`.trim(),
          cantidadReal: captura.cantidad,
          cantidadRechazada: totalRechazados,
          cantidadNeta,
          cantidadEstandar: estandarBase || null,
          eficiencia,
        });
      }
    }

    return rows;
  }
}