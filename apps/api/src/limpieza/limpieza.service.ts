import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LimpiezaService {
  private readonly logger = new Logger(LimpiezaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cierre automático de asignaciones activas a las 20:00 CDMX (02:00 UTC día siguiente).
   * También cierra cualquier asignación activa de días anteriores que haya quedado abierta.
   */
  @Cron('0 2 * * *', { name: 'cierre_nocturno', timeZone: 'UTC' })
  async cierreNocturno() {
    this.logger.log('Iniciando cierre nocturno de asignaciones...');

    // Cierra todas las asignaciones que siguen activas (hoy y días anteriores)
    const activas = await this.prisma.meroAsignacion.findMany({
      where: { activa: true },
      select: { id: true, horaInicio: true },
    });

    if (!activas.length) {
      this.logger.log('Sin asignaciones activas para cerrar.');
      return;
    }

    // Hora de cierre: 20:00 CDMX
    const horaFin = '20:00';

    await this.prisma.meroAsignacion.updateMany({
      where: { id: { in: activas.map((a) => a.id) } },
      data: {
        activa: false,
        horaFin,
        // duracionMinutos no se calcula aquí porque puede ser de días anteriores;
        // se deja null para no generar datos incorrectos en el resumen.
      },
    });

    this.logger.log(`Cierre nocturno: ${activas.length} asignaciones cerradas.`);
  }

  /**
   * Corre el día 1 de cada mes par (ene, mar, may, jul, sep, nov) a las 02:00 CDMX (08:00 UTC).
   * 1. Agrega producción de los últimos 60 días en MeroResumenBimestral.
   * 2. Borra asignaciones y capturas > 60 días (operativas de bajo valor a largo plazo).
   * 3. Borra auditoría > 90 días.
   */
  @Cron('0 8 1 1,3,5,7,9,11 *', { name: 'limpieza_bimestral', timeZone: 'UTC' })
  async ejecutarLimpieza() {
    this.logger.log('Iniciando limpieza bimestral...');

    const hoy = new Date();
    const corte60 = new Date(hoy);
    corte60.setDate(corte60.getDate() - 60);

    const corte90 = new Date(hoy);
    corte90.setDate(corte90.getDate() - 90);

    const periodoFin = new Date(corte60);
    periodoFin.setDate(periodoFin.getDate() - 1);
    const periodoInicio = new Date(periodoFin);
    periodoInicio.setDate(periodoInicio.getDate() - 61);

    try {
      await this.generarResumen(periodoInicio, periodoFin);
      await this.borrarOperativos(corte60);
      await this.borrarAuditoria(corte90);
      this.logger.log('Limpieza bimestral completada.');
    } catch (err) {
      this.logger.error('Error en limpieza bimestral', err);
    }
  }

  private async generarResumen(desde: Date, hasta: Date) {
    // Agrupa capturas por (empleado, área, subtarea, modelo) en el periodo
    const asignaciones = await this.prisma.meroAsignacion.findMany({
      where: {
        tipo: 'DIRECTA',
        fecha: { gte: desde, lte: hasta },
        capturas: { some: {} },
      },
      include: {
        capturas: { include: { rechazos: true } },
      },
    });

    // Agrupar por empleado + área + subtarea + modelo
    const mapa = new Map<string, {
      empleadoId: number;
      areaId: number;
      subtareaId: number;
      modeloId: number;
      totalPiezas: number;
      totalRechazos: number;
      minutosActivos: number;
      empleados: Set<number>;
    }>();

    for (const asg of asignaciones) {
      if (!asg.areaId || !asg.subtareaId || !asg.modeloId) continue;

      const key = `${asg.empleadoId}-${asg.areaId}-${asg.subtareaId}-${asg.modeloId}`;
      const entry = mapa.get(key) ?? {
        empleadoId: asg.empleadoId,
        areaId: asg.areaId,
        subtareaId: asg.subtareaId,
        modeloId: asg.modeloId,
        totalPiezas: 0,
        totalRechazos: 0,
        minutosActivos: 0,
        empleados: new Set(),
      };

      for (const cap of asg.capturas) {
        entry.totalPiezas += cap.cantidad;
        entry.totalRechazos += cap.rechazos.reduce((s, r) => s + r.cantidad, 0);
      }
      entry.minutosActivos += asg.duracionMinutos ?? 0;
      entry.empleados.add(asg.empleadoId);
      mapa.set(key, entry);
    }

    // Agregar minutos de indirectas por empleado+area del mismo periodo
    const indirectas = await this.prisma.meroAsignacion.findMany({
      where: {
        tipo: 'INDIRECTA',
        fecha: { gte: desde, lte: hasta },
      },
      select: { empleadoId: true, areaId: true, duracionMinutos: true },
    });

    const minutosIndMap = new Map<string, number>();
    for (const ind of indirectas) {
      const k = `${ind.empleadoId}-${ind.areaId ?? 0}`;
      minutosIndMap.set(k, (minutosIndMap.get(k) ?? 0) + (ind.duracionMinutos ?? 0));
    }

    // Insertar resúmenes
    const resumenesData = Array.from(mapa.values()).map((e) => ({
      periodoInicio: desde,
      periodoFin: hasta,
      empleadoId: e.empleadoId,
      areaId: e.areaId,
      subtareaId: e.subtareaId,
      modeloId: e.modeloId,
      totalPiezas: e.totalPiezas,
      totalRechazos: e.totalRechazos,
      minutosIndirectos: minutosIndMap.get(`${e.empleadoId}-${e.areaId}`) ?? 0,
      horasActivas: Math.round((e.minutosActivos / 60) * 100) / 100,
      empleadosCount: e.empleados.size,
    }));

    if (resumenesData.length > 0) {
      await this.prisma.meroResumenBimestral.createMany({ data: resumenesData });
      this.logger.log(`Resúmenes generados: ${resumenesData.length} filas`);
    }
  }

  private async borrarOperativos(corte: Date) {
    // Borrar capturas primero (FK), luego asignaciones
    const asignacionesViejas = await this.prisma.meroAsignacion.findMany({
      where: { fecha: { lt: corte } },
      select: { id: true },
    });

    const ids = asignacionesViejas.map((a) => a.id);
    if (!ids.length) return;

    // Borrar rechazos → capturas → asignaciones en cascada manual
    const capturas = await this.prisma.meroCaptura.findMany({
      where: { asignacionId: { in: ids } },
      select: { id: true },
    });
    const capturaIds = capturas.map((c) => c.id);

    if (capturaIds.length) {
      await this.prisma.meroRechazo.deleteMany({ where: { capturaId: { in: capturaIds } } });
      await this.prisma.meroCaptura.deleteMany({ where: { id: { in: capturaIds } } });
    }

    const { count } = await this.prisma.meroAsignacion.deleteMany({ where: { id: { in: ids } } });
    this.logger.log(`Asignaciones eliminadas: ${count}`);
  }

  private async borrarAuditoria(corte: Date) {
    const { count } = await this.prisma.meroAuditoria.deleteMany({
      where: { timestamp: { lt: corte } },
    });
    this.logger.log(`Registros de auditoría eliminados: ${count}`);
  }
}
