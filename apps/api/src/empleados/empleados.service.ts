import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { VitaEmpleado, VitaSyncService } from './vita-sync.service';
import { MailService } from './mail.service';

/**
 * Servicio principal para la gestión de empleados en MERO.
 *
 * Responsabilidades:
 * - Consultar empleados almacenados en MERO.
 * - Enriquecer datos con información fresca desde VITA (ERP).
 * - Resolver empleados por QR.
 * - Generar imagen PNG del código QR asociado al empleado.
 * - Guardar QR en disco con nombre descriptivo (Tarea 4.2).
 * - Enviar QR por correo electrónico (Tarea 5).
 *
 * Nota arquitectónica:
 * MERO mantiene su propia tabla `meroEmpleado`,
 * pero VITA es la fuente de verdad para datos laborales.
 *
 * Decisión — normalización de caracteres en nombres de archivo:
 * Los acentos y la ñ se convierten a ASCII mediante NFD + strip de diacríticos.
 * Esto evita problemas de compatibilidad en filesystems FAT/exFAT y
 * herramientas de línea de comandos que no manejan UTF-8 correctamente.
 */

/** Ruta de la carpeta donde se guardan los QR generados. */
const QR_DIR = process.env.QR_DIR
  ? path.resolve(process.env.QR_DIR)
  : path.resolve(__dirname, '..', '..', 'QR');

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vitaSync: VitaSyncService,
    private readonly mail: MailService,
  ) {
    // Garantizar que la carpeta QR/ exista al iniciar
    fs.mkdirSync(QR_DIR, { recursive: true });
  }

  /* ────── Helpers de nombre de archivo ────── */

  /**
   * Normaliza un string para uso seguro en nombres de archivo:
   * - Elimina diacríticos (á→a, ñ→n, etc.)
   * - Reemplaza caracteres no alfanuméricos con guión bajo
   * - Colapsa guiones bajos múltiples
   */
  private normalizeForFilename(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Retorna el nombre de archivo esperado para el QR de un empleado.
   * Formato: Nombre_ApellidoPaterno_TelefonoCelular.png
   */
  private getQrFilename(
    emp: { nombre: string; apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno' | 'Telefono_Celular'> | null,
  ): string {
    const nombre = this.normalizeForFilename(emp.nombre) || 'SinNombre';
    const apellidoPaterno = this.getApellidoPaterno(emp, vita);
    const telefonoRaw = vita?.Telefono_Celular?.trim();
    const telefono = telefonoRaw
      ? this.normalizeForFilename(telefonoRaw) || 'SinTelefono'
      : 'SinTelefono';

    return `${nombre}_${apellidoPaterno}_${telefono}.png`;
  }

  /**
   * Obtiene apellido paterno priorizando dato fresco desde VITA.
   */
  private getApellidoPaterno(
    emp: { apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno'> | null,
  ): string {
    const raw = vita?.Apellido_Paterno || (emp.apellidos ?? '').split(' ')[0] || '';
    return this.normalizeForFilename(raw) || 'SinApellido';
  }

  /**
   * Prefijo para identificar cualquier QR perteneciente al empleado.
   * Permite detectar QR incluso si cambió el teléfono.
   */
  private getEmployeeFilenamePrefix(
    emp: { nombre: string; apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno'> | null,
  ): string {
    const nombre = this.normalizeForFilename(emp.nombre) || 'SinNombre';
    const apellidoPaterno = this.getApellidoPaterno(emp, vita);
    return `${nombre}_${apellidoPaterno}_`;
  }

  /**
   * Lista archivos QR existentes para un empleado (por prefijo nombre+apellido).
   */
  private getExistingQrFilesByEmployee(
    emp: { nombre: string; apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno'> | null,
  ): string[] {
    try {
      const prefix = this.getEmployeeFilenamePrefix(emp, vita);
      return fs
        .readdirSync(QR_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter(
          (name) =>
            name.startsWith(prefix) && name.toLowerCase().endsWith('.png'),
        );
    } catch {
      return [];
    }
  }

  private hasQrFile(
    emp: { nombre: string; apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno'> | null,
  ): boolean {
    return this.getExistingQrFilesByEmployee(emp, vita).length > 0;
  }

  /**
   * Genera (si hace falta) y persiste el QR de un empleado concreto.
   * Reutiliza el archivo existente cuando ya coincide el nombre esperado.
   */
  private async ensureQrFileForEmployee(
    empleado: {
      id: number;
      idVita: number;
      uuidQr: string;
      nombre: string;
      apellidos: string | null;
    },
    vita: VitaEmpleado | null,
  ): Promise<{ filename: string; buffer: Buffer }> {
    if (!vita?.Telefono_Celular) {
      this.logger.warn(
        `Empleado #${empleado.id} (${empleado.nombre}) no tiene Telefono_Celular en VITA — usando "SinTelefono" en nombre de archivo`,
      );
    }

    const filename = this.getQrFilename(empleado, vita);
    const filePath = this.getQrFilePath(empleado, vita);

    // Evitar archivos obsoletos cuando cambia el teléfono en VITA.
    const staleFiles = this.getExistingQrFilesByEmployee(empleado, vita).filter(
      (existing) => existing !== filename,
    );
    for (const stale of staleFiles) {
      try {
        fs.unlinkSync(path.join(QR_DIR, stale));
      } catch {
        // Si no se puede borrar, no bloqueamos la generación/envío.
      }
    }

    if (fs.existsSync(filePath)) {
      return { filename, buffer: fs.readFileSync(filePath) };
    }

    const buffer = await this.buildQrBuffer(empleado.uuidQr);
    fs.writeFileSync(filePath, buffer);

    this.logger.log(`QR guardado: ${filename}`);
    return { filename, buffer };
  }

  /** Retorna la ruta absoluta del archivo QR para un empleado. */
  private getQrFilePath(
    emp: { nombre: string; apellidos: string | null },
    vita: Pick<VitaEmpleado, 'Apellido_Paterno' | 'Telefono_Celular'> | null,
  ): string {
    return path.join(QR_DIR, this.getQrFilename(emp, vita));
  }

  /* ────── Consultas ────── */

  async findAll() {
    const empleadosMero = await this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const vitaEmpleados = await this.vitaSync.queryVitaEmpleados();
    const vitaMap = new Map(vitaEmpleados.map((v) => [v.ID_Empleado, v]));

    const enriched: Array<any> = [];

    for (const emp of empleadosMero) {
      const vita = vitaMap.get(emp.idVita);

      const hasEmail = !!(vita?.Email_Corporativo || vita?.Email_Personal);
      let hasQr = this.hasQrFile(emp, vita ?? null);

      // Garantizar que la carpeta QR contenga el archivo de cada empleado activo.
      if (!hasQr) {
        try {
          await this.ensureQrFileForEmployee(emp, vita ?? null);
          hasQr = true;
        } catch (err: any) {
          this.logger.warn(
            `No se pudo generar QR para empleado #${emp.id}: ${err.message}`,
          );
        }
      }

      enriched.push({
        ...emp,
        hasEmail,
        hasQr,
        vita: vita
          ? {
              puesto: vita.Nombre_Puesto,
              area: vita.Nombre_Area,
              fechaIngreso: vita.Fecha_Ingreso,
              email: vita.Email_Corporativo,
              emailPersonal: vita.Email_Personal,
            }
          : null,
      });
    }

    return enriched;
  }

  /**
   * Garantiza que exista un archivo QR para todos los empleados activos.
   * Se usa al terminar la sincronización con VITA.
   */
  async ensureQrsForActivos(): Promise<{
    generados: number;
    existentes: number;
    errores: number;
  }> {
    const empleados = await this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
    });

    const vitaEmpleados = await this.vitaSync.queryVitaEmpleados();
    const vitaMap = new Map(vitaEmpleados.map((v) => [v.ID_Empleado, v]));

    let generados = 0;
    let existentes = 0;
    let errores = 0;

    for (const emp of empleados) {
      const vita = vitaMap.get(emp.idVita) ?? null;
      const existedBefore = this.hasQrFile(emp, vita);

      try {
        await this.ensureQrFileForEmployee(emp, vita);
        if (existedBefore) existentes++;
        else generados++;
      } catch (err: any) {
        errores++;
        this.logger.warn(
          `No se pudo asegurar QR para empleado #${emp.id}: ${err.message}`,
        );
      }
    }

    return { generados, existentes, errores };
  }

  async findOne(id: number) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
      include: {
        asignaciones: {
          orderBy: { fecha: 'desc' },
          include: {
            area: { select: { nombre: true } },
            subtarea: { select: { nombre: true } },
            modelo: { select: { nombreSku: true } },
          },
        },
      },
    });

    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    const vita = await this.vitaSync.getVitaEmpleadoDetalle(empleado.idVita);

    return {
      ...empleado,
      vita: vita
        ? {
            puesto: vita.Nombre_Puesto,
            area: vita.Nombre_Area,
            fechaIngreso: vita.Fecha_Ingreso,
            email: vita.Email_Corporativo,
            emailPersonal: vita.Email_Personal,
            estatus: vita.ID_Estatus,
          }
        : null,
    };
  }

  async findByQr(uuidQr: string) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { uuidQr },
    });

    if (!empleado) throw new NotFoundException('Empleado no encontrado por QR');

    return empleado;
  }

  /* ────── Generación de QR ────── */

  /**
   * Genera el QR del empleado con watermark (logo tenue al centro).
   * Retorna el buffer PNG — NO guarda en disco.
   * Usado por el endpoint GET /empleados/:id/qr-image.
   *
   * IMPORTANTE:
   * - El watermark debe ir ENCIMA del QR (no abajo), porque el QR tiene fondo blanco opaco.
   * - La opacidad se controla en el SVG (no dependemos de `opacity` en sharp).
   */
  async generateQrImage(id: number): Promise<Buffer> {
    const { buffer } = await this.ensureQrFile(id);
    return buffer;
  }

  /**
   * Genera el QR y lo guarda en QR/ con el formato de nombre descriptivo.
   * Formato: Nombre_ApellidoPaterno_TelefonoCelular.png
   * Si ya existe, se sobreescribe (no se generan duplicados con sufijos).
   * Si no tiene teléfono, usa "SinTelefono" en el nombre + warning en log.
   * Retorna el nombre del archivo generado.
   */
  async ensureQrFile(id: number): Promise<{ filename: string; buffer: Buffer }> {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    const vita = await this.vitaSync.getVitaEmpleadoDetalle(empleado.idVita);
    return this.ensureQrFileForEmployee(empleado, vita ?? null);
  }

  /* ────── Envío de QR por correo ────── */

  /**
   * Envía el QR por correo a los empleados indicados.
   * - Determina email: Email_Corporativo > Email_Personal > null
   * - Si no tiene correo, registra como "sin_correo" (no es error fatal)
   * - Si no existe archivo QR, lo genera antes de enviar
   * - Delay de 1.5s entre correos para evitar throttling de Outlook
   */
  async enviarQr(ids: number[]): Promise<{
    resultados: {
      id: number;
      nombre: string;
      email: string | null;
      status: 'enviado' | 'fallido' | 'sin_correo';
      error?: string;
    }[];
    totales: { enviados: number; fallidos: number; sinCorreo: number };
  }> {
    const resultados: {
      id: number;
      nombre: string;
      email: string | null;
      status: 'enviado' | 'fallido' | 'sin_correo';
      error?: string;
    }[] = [];

    let enviados = 0;
    let fallidos = 0;
    let sinCorreo = 0;

    for (const id of ids) {
      try {
        const empleado = await this.prisma.meroEmpleado.findUnique({
          where: { id },
        });

        if (!empleado) {
          resultados.push({
            id,
            nombre: `ID ${id}`,
            email: null,
            status: 'fallido',
            error: 'Empleado no encontrado',
          });
          fallidos++;
          continue;
        }

        const vita = await this.vitaSync.getVitaEmpleadoDetalle(empleado.idVita);
        const email = vita?.Email_Corporativo || vita?.Email_Personal || null;

        if (!email) {
          resultados.push({
            id,
            nombre: `${empleado.nombre} ${empleado.apellidos || ''}`.trim(),
            email: null,
            status: 'sin_correo',
          });
          sinCorreo++;
          continue;
        }

        // Asegurarse de que el QR existe en disco
        let filename: string;
        let qrBuffer: Buffer;
        try {
          const result = await this.ensureQrFile(id);
          filename = result.filename;
          qrBuffer = result.buffer;
        } catch (qrErr: any) {
          resultados.push({
            id,
            nombre: `${empleado.nombre} ${empleado.apellidos || ''}`.trim(),
            email,
            status: 'fallido',
            error: `Error generando QR: ${qrErr.message}`,
          });
          fallidos++;
          continue;
        }

        // Enviar correo
        try {
          await this.mail.sendQrEmail(
            email,
            `${empleado.nombre} ${empleado.apellidos || ''}`.trim(),
            qrBuffer,
            filename,
          );
          resultados.push({
            id,
            nombre: `${empleado.nombre} ${empleado.apellidos || ''}`.trim(),
            email,
            status: 'enviado',
          });
          enviados++;
          this.logger.log(`QR enviado a ${email} (${empleado.nombre})`);
        } catch (mailErr: any) {
          resultados.push({
            id,
            nombre: `${empleado.nombre} ${empleado.apellidos || ''}`.trim(),
            email,
            status: 'fallido',
            error: `Error de correo: ${mailErr.message}`,
          });
          fallidos++;
          this.logger.error(`Error enviando QR a ${email}: ${mailErr.message}`);
        }

        // Delay anti-throttling de Outlook (300 correos/día)
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err: any) {
        resultados.push({
          id,
          nombre: `ID ${id}`,
          email: null,
          status: 'fallido',
          error: err.message,
        });
        fallidos++;
      }
    }

    return {
      resultados,
      totales: { enviados, fallidos, sinCorreo },
    };
  }

  /* ────── Helpers privados ────── */

  private resolveLogoPath(): string | null {
    const envLogo = process.env.QR_LOGO_PATH?.trim();
    const candidates = [
      envLogo
        ? path.isAbsolute(envLogo)
          ? envLogo
          : path.resolve(process.cwd(), envLogo)
        : null,
      path.resolve(process.cwd(), 'apps', 'api', 'assets', 'logo.png'),
      path.resolve(process.cwd(), 'assets', 'logo.png'),
      path.resolve(__dirname, '..', '..', 'assets', 'logo.png'),
    ].filter((candidate): candidate is string => !!candidate);

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        // Ignorado: se prueba con el siguiente candidato.
      }
    }

    return null;
  }

  /**
   * Construye el buffer PNG del QR con watermark de logo.
   * El contenido codificado es el uuidQr del empleado.
   */
  private async buildQrBuffer(uuidQr: string): Promise<Buffer> {
    const SIZE = 900;
    const OUTPUT_SIZE = 900;
    const MARGIN = 3;
    const LOGO_RATIO = 0.18;
    const PAD_RATIO = 1.25;
    const DARK = '#000000';
    const LIGHT = '#FFFFFF';

    const qrPng = await QRCode.toBuffer(uuidQr, {
      type: 'png',
      width: SIZE,
      margin: MARGIN,
      errorCorrectionLevel: 'H',
      color: { dark: DARK, light: LIGHT },
    });

    const baseQr = await sharp(qrPng)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE)
      .png()
      .toBuffer();

    const logoPath = this.resolveLogoPath();
    if (!logoPath) {
      this.logger.warn(
        'No se encontró logo para watermark QR; se usará QR limpio',
      );
      return baseQr;
    }

    try {
      const meta = await sharp(qrPng).metadata();
      const w = meta.width ?? SIZE;
      const h = meta.height ?? SIZE;
      const qrSize = Math.min(w, h);

      const logoSize = Math.round(qrSize * LOGO_RATIO);
      const padSize = Math.round(logoSize * PAD_RATIO);

      const logo = await sharp(logoPath)
        .resize(logoSize, logoSize, { fit: 'contain' })
        .png()
        .toBuffer();

      const whitePad = await sharp({
        create: {
          width: padSize,
          height: padSize,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([{ input: logo, gravity: 'center' }])
        .png()
        .toBuffer();

      const composed = await sharp(qrPng)
        .composite([{ input: whitePad, gravity: 'center' }])
        .png()
        .toBuffer();

      return sharp(composed).resize(OUTPUT_SIZE, OUTPUT_SIZE).png().toBuffer();
    } catch (error: any) {
      this.logger.warn(
        `Fallo al aplicar watermark de logo; se usará QR limpio (${error?.message || 'sin detalle'})`,
      );
      return baseQr;
    }
  }
}
