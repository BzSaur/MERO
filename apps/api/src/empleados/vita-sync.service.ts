import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Interfaz que representa un empleado leído desde VITA (ERP).
 * Solo lectura — MERO nunca escribe en VITA.
 */
export interface VitaEmpleado {
  ID_Empleado: number;
  Nombre: string;
  Apellido_Paterno: string;
  Apellido_Materno: string | null;
  ID_Area: number;
  ID_Estatus: number;
  Fecha_Ingreso: Date;
  Salario_Diario: number | null;
  Email_Corporativo: string | null;
  Email_Personal: string | null;
  Telefono_Celular: string | null;
  Nombre_Puesto: string | null;
  Nombre_Area: string | null;
}

@Injectable()
export class VitaSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VitaSyncService.name);
  private vitaPool: Pool;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /* ────── Ciclo de vida ────── */

  async onModuleInit() {
    this.vitaPool = new Pool({
      host: this.config.get('VITA_DB_HOST', 'localhost'),
      port: this.config.get<number>('VITA_DB_PORT', 5432),
      user: this.config.get('VITA_DB_USER', 'erp_user'),
      password: this.config.get('VITA_DB_PASSWORD', 'erp_password'),
      database: this.config.get('VITA_DB_NAME', 'erp_rh'),
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    try {
      const client = await this.vitaPool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      this.logger.log(
        `Conexion a VITA establecida — ${result.rows[0].now}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `No se pudo conectar a VITA: ${err.message}. El sync funcionara cuando VITA este disponible.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.vitaPool?.end();
    this.logger.log('Pool de conexion a VITA cerrado');
  }

  /* ────── Sync programado ────── */

  /** Sync cada 5 minutos — refresca empleados activos desde VITA */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync() {
    await this.syncAll();
  }

  /* ────── Sync completo ────── */

  /**
   * Sincroniza TODOS los empleados desde VITA.
   * - Empleados activos en VITA -> se crean/actualizan en MERO con activo=true
   * - Empleados dados de baja en VITA -> se marcan activo=false en MERO
   * - MERO nunca escribe en VITA, solo lee.
   */
  async syncAll(): Promise<{
    sincronizados: number;
    desactivados: number;
    errores: number;
  }> {
    let sincronizados = 0;
    let desactivados = 0;
    let errores = 0;

    try {
      const vitaEmpleados = await this.queryVitaEmpleados();

      if (!vitaEmpleados.length) {
        this.logger.warn('No se obtuvieron empleados de VITA');
        return { sincronizados: 0, desactivados: 0, errores: 0 };
      }

      const idsVitaActivos = new Set(
        vitaEmpleados
          .filter((e) => e.ID_Estatus === 1)
          .map((e) => e.ID_Empleado),
      );

      for (const emp of vitaEmpleados) {
        try {
          const activo = emp.ID_Estatus === 1;

          await this.prisma.meroEmpleado.upsert({
            where: { idVita: emp.ID_Empleado },
            create: {
              idVita: emp.ID_Empleado,
              uuidQr: uuidv4(),
              nombre: emp.Nombre,
              apellidos: [emp.Apellido_Paterno, emp.Apellido_Materno]
                .filter(Boolean)
                .join(' '),
              idAreaVita: emp.ID_Area,
              activo,
            },
            update: {
              nombre: emp.Nombre,
              apellidos: [emp.Apellido_Paterno, emp.Apellido_Materno]
                .filter(Boolean)
                .join(' '),
              idAreaVita: emp.ID_Area,
              activo,
            },
          });

          sincronizados++;
        } catch (err: any) {
          this.logger.error(
            `Error sincronizando empleado VITA #${emp.ID_Empleado}: ${err.message}`,
          );
          errores++;
        }
      }

      // Desactivar empleados que ya no estan activos en VITA
      const empleadosMero = await this.prisma.meroEmpleado.findMany({
        where: { activo: true },
        select: { id: true, idVita: true },
      });

      for (const meroEmp of empleadosMero) {
        if (!idsVitaActivos.has(meroEmp.idVita)) {
          await this.prisma.meroEmpleado.update({
            where: { id: meroEmp.id },
            data: { activo: false },
          });
          desactivados++;
        }
      }

      this.logger.log(
        `Sync VITA completado: ${sincronizados} sincronizados, ${desactivados} desactivados, ${errores} errores`,
      );
    } catch (err: any) {
      this.logger.error(`Error general en sync VITA: ${err.message}`);
    }

    return { sincronizados, desactivados, errores };
  }

  /* ────── Sync individual ────── */

  /**
   * Busca un empleado especifico en VITA por su ID y lo importa a MERO.
   * Util cuando se escanea un QR de un empleado que aun no existe en MERO.
   */
  async syncOneByVitaId(idVita: number) {
    try {
      const result = await this.vitaPool.query<VitaEmpleado>(
        `SELECT e."ID_Empleado", e."Nombre", e."Apellido_Paterno", e."Apellido_Materno",
                e."ID_Area", e."ID_Estatus", e."Fecha_Ingreso",
                e."Salario_Diario", e."Email_Corporativo", e."Email_Personal",
                e."Telefono_Celular",
                p."Nombre_Puesto", a."Nombre_Area"
         FROM "Empleados" e
         LEFT JOIN "Cat_Puestos" p ON e."ID_Puesto" = p."ID_Puesto"
         LEFT JOIN "Cat_Areas" a ON e."ID_Area" = a."ID_Area"
         WHERE e."ID_Empleado" = $1`,
        [idVita],
      );

      if (!result.rows.length) {
        this.logger.warn(`Empleado VITA #${idVita} no encontrado`);
        return null;
      }

      const emp = result.rows[0];
      const activo = emp.ID_Estatus === 1;

      const empleado = await this.prisma.meroEmpleado.upsert({
        where: { idVita: emp.ID_Empleado },
        create: {
          idVita: emp.ID_Empleado,
          uuidQr: uuidv4(),
          nombre: emp.Nombre,
          apellidos: [emp.Apellido_Paterno, emp.Apellido_Materno]
            .filter(Boolean)
            .join(' '),
          idAreaVita: emp.ID_Area,
          activo,
        },
        update: {
          nombre: emp.Nombre,
          apellidos: [emp.Apellido_Paterno, emp.Apellido_Materno]
            .filter(Boolean)
            .join(' '),
          idAreaVita: emp.ID_Area,
          activo,
        },
      });

      this.logger.log(
        `Empleado VITA #${idVita} sincronizado -> MERO #${empleado.id}`,
      );
      return empleado;
    } catch (err: any) {
      this.logger.error(
        `Error sincronizando empleado VITA #${idVita}: ${err.message}`,
      );
      return null;
    }
  }

  /* ────── Consultas directas a VITA (read-only) ────── */

  /**
   * Lee todos los empleados de VITA con puesto, area, email y teléfono.
   */
  async queryVitaEmpleados(): Promise<VitaEmpleado[]> {
    try {
      const result = await this.vitaPool.query<VitaEmpleado>(
        `SELECT e."ID_Empleado", e."Nombre", e."Apellido_Paterno", e."Apellido_Materno",
                e."ID_Area", e."ID_Estatus", e."Fecha_Ingreso",
                e."Salario_Diario", e."Email_Corporativo", e."Email_Personal",
                e."Telefono_Celular",
                p."Nombre_Puesto", a."Nombre_Area"
         FROM "Empleados" e
         LEFT JOIN "Cat_Puestos" p ON e."ID_Puesto" = p."ID_Puesto"
         LEFT JOIN "Cat_Areas" a ON e."ID_Area" = a."ID_Area"
         ORDER BY e."Nombre" ASC`,
      );

      return result.rows;
    } catch (err: any) {
      this.logger.error(`Error consultando VITA: ${err.message}`);
      return [];
    }
  }

  /**
   * Lee un empleado de VITA con todos sus datos.
   * Para mostrar info fresca en MERO sin duplicar datos.
   */
  async getVitaEmpleadoDetalle(
    idVita: number,
  ): Promise<VitaEmpleado | null> {
    try {
      const result = await this.vitaPool.query<VitaEmpleado>(
        `SELECT e."ID_Empleado", e."Nombre", e."Apellido_Paterno", e."Apellido_Materno",
                e."ID_Area", e."ID_Estatus", e."Fecha_Ingreso",
                e."Salario_Diario", e."Email_Corporativo", e."Email_Personal",
                e."Telefono_Celular",
                p."Nombre_Puesto", a."Nombre_Area"
         FROM "Empleados" e
         LEFT JOIN "Cat_Puestos" p ON e."ID_Puesto" = p."ID_Puesto"
         LEFT JOIN "Cat_Areas" a ON e."ID_Area" = a."ID_Area"
         WHERE e."ID_Empleado" = $1`,
        [idVita],
      );

      return result.rows[0] || null;
    } catch (err: any) {
      this.logger.error(
        `Error consultando empleado VITA #${idVita}: ${err.message}`,
      );
      return null;
    }
  }
}
