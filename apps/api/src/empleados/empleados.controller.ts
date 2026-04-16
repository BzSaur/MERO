import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmpleadosService } from './empleados.service';
import { VitaSyncService } from './vita-sync.service';

@Controller('empleados')
@UseGuards(JwtAuthGuard)
export class EmpleadosController {
  constructor(
    private readonly service: EmpleadosService,
    private readonly vitaSync: VitaSyncService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get('qr/:uuidQr')
  findByQr(@Param('uuidQr') uuidQr: string) {
    return this.service.findByQr(uuidQr);
  }

  @Get(':id/qr-image')
  async getQrImage(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateQrImage(id);
    res.set({ 'Content-Type': 'image/png' });
    res.send(buffer);
  }

  @Post('sync')
  async syncFromVita() {
    const sync = await this.vitaSync.syncAll();
    const qr = await this.service.ensureQrsForActivos();
    return { ...sync, qr };
  }

  /**
   * Envía el QR por correo a los empleados indicados.
   * Body: { ids: number[] }
   * Response: { resultados: [...], totales: { enviados, fallidos, sinCorreo } }
   */
  @Post('enviar-qr')
  async enviarQr(@Body() body: { ids: number[] }) {
    return this.service.enviarQr(body.ids ?? []);
  }
}
