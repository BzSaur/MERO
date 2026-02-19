import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Servicio de sincronización con VITA.
 * En producción, conecta a la BD de VITA (read-only) para importar empleados activos.
 * Por ahora, contiene la estructura lista para implementar la conexión real.
 */
@Injectable()
export class VitaSyncService {
  private readonly logger = new Logger(VitaSyncService.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(readonly prisma: PrismaService) {}

  /** Sync nocturno automático — refresca empleados activos desde VITA */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledSync() {
    this.logger.log('Iniciando sync nocturno con VITA...');
    await this.syncAll();
    this.logger.log('Sync nocturno con VITA completado');
  }

  /**
   * Sincroniza todos los empleados activos desde VITA.
   * TODO: Implementar conexión real a BD VITA con usuario read-only.
   */
  async syncAll() {
    this.logger.log('Sync manual con VITA iniciado');
    // TODO: Conectar a VITA DB y obtener empleados activos
    // const vitaEmpleados = await vitaConnection.query('SELECT ...');
    // for (const emp of vitaEmpleados) {
    //   await this.prisma.meroEmpleado.upsert({
    //     where: { idVita: emp.id },
    //     create: { idVita: emp.id, nombre: emp.nombre, uuidQr: uuid(), activo: true },
    //     update: { nombre: emp.nombre, activo: emp.activo },
    //   });
    // }
    return { message: 'Sync con VITA pendiente de configuración' };
  }

  /**
   * Importa un empleado individual al escanear un QR desconocido.
   * TODO: Implementar búsqueda on-demand en VITA.
   */
  async syncOneByVitaId(_idVita: number) {
    this.logger.log(`Buscando empleado ${_idVita} en VITA...`);
    // TODO: Buscar en VITA y crear en MERO
    return null;
  }
}
