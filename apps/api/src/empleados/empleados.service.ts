import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { VitaSyncService } from './vita-sync.service';

/**
 * Servicio principal para la gestión de empleados en MERO.
 *
 * Responsabilidades:
 * - Consultar empleados almacenados en MERO.
 * - Enriquecer datos con información fresca desde VITA (ERP).
 * - Resolver empleados por QR.
 * - Generar imagen PNG del código QR asociado al empleado.
 *
 * Nota arquitectónica:
 * MERO mantiene su propia tabla `meroEmpleado`,
 * pero VITA es la fuente de verdad para datos laborales.
 */
@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService, // Acceso a base de datos MERO
    private readonly vitaSync: VitaSyncService, // Servicio para consultar datos en VITA (read-only)
  ) {}

  async findAll() {
    const empleadosMero = await this.prisma.meroEmpleado.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const vitaEmpleados = await this.vitaSync.queryVitaEmpleados();
    const vitaMap = new Map(vitaEmpleados.map((v) => [v.ID_Empleado, v]));

    return empleadosMero.map((emp) => {
      const vita = vitaMap.get(emp.idVita);

      return {
        ...emp,
        vita: vita
          ? {
              puesto: vita.Nombre_Puesto,
              area: vita.Nombre_Area,
              fechaIngreso: vita.Fecha_Ingreso,
              email: vita.Email_Corporativo,
            }
          : null,
      };
    });
  }

  async findOne(id: number) {
    const empleado = await this.prisma.meroEmpleado.findUnique({
      where: { id },
      include: {
        asignaciones: {
          take: 10,
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

  /**
   * Genera el QR del empleado con watermark (logo tenue al centro).
   *
   * IMPORTANTE:
   * - El watermark debe ir ENCIMA del QR (no abajo), porque el QR tiene fondo blanco opaco.
   * - La opacidad se controla en el SVG (no dependemos de `opacity` en sharp).
   */
  async generateQrImage(id: number): Promise<Buffer> {
  const empleado = await this.prisma.meroEmpleado.findUnique({
    where: { id },
  });

  if (!empleado) throw new NotFoundException('Empleado no encontrado');

  // ===== Config segura =====
  const SIZE = 600;          // generamos grande y luego bajamos a 300
  const MARGIN = 3;          // quiet zone
  const LOGO_RATIO = 0.18;   // 15%–20% recomendado
  const PAD_RATIO = 1.25;    // padding blanco alrededor del logo
  const DARK = '#000000';
  const LIGHT = '#FFFFFF';

  // Ruta del logo dentro del contenedor (ya confirmaste que existe)
  const logoPath = path.join(process.cwd(), 'apps/api/assets/logo.png');

  // 1) QR base con alta tolerancia (permite “tapar” el centro)
  const qrPng = await QRCode.toBuffer(empleado.uuidQr, {
    type: 'png',
    width: SIZE,
    margin: MARGIN,
    errorCorrectionLevel: 'H',
    color: { dark: DARK, light: LIGHT },
  });

  // 2) Medir QR para calcular tamaños
  const meta = await sharp(qrPng).metadata();
  const w = meta.width ?? SIZE;
  const h = meta.height ?? SIZE;
  const qrSize = Math.min(w, h);

  const logoSize = Math.round(qrSize * LOGO_RATIO);
  const padSize = Math.round(logoSize * PAD_RATIO);

  // 3) Preparar logo (centrado)
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  // 4) Crear cuadro blanco (padding) + logo encima
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

  // 5) Componer: QR + pad blanco con logo al centro
  const composed = await sharp(qrPng)
    .composite([{ input: whitePad, gravity: 'center' }])
    .png()
    .toBuffer();

  // 6) Salida final tamaño UI
  return await sharp(composed).resize(300, 300).png().toBuffer();
}
}