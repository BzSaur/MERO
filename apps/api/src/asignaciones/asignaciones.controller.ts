import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AsignacionesService } from './asignaciones.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  /**
   * Crear asignación por escaneo (QR → empleado)
   */
  @Post('scan')
  scan(@Body() dto: ScanQrDto) {
    return this.asignaciones.scan(dto);
  }

  /**
   * Listar asignaciones activas del día (opcional filtro por área)
   */
  @Get('activas')
  activas(@Query('areaId') areaId?: string) {
    const parsed = areaId ? parseInt(areaId, 10) : undefined;
    return this.asignaciones.findActivas(Number.isFinite(parsed) ? parsed : undefined);
  }

  /**
   * Listar asignaciones por empleado (opcional fecha YYYY-MM-DD)
   */
  @Get('empleado/:empleadoId')
  byEmpleado(
    @Param('empleadoId', ParseIntPipe) empleadoId: number,
    @Query('fecha') fecha?: string,
  ) {
    return this.asignaciones.findByEmpleado(empleadoId, fecha);
  }

  /**
   * Obtener asignación por id
   */
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number) {
    return this.asignaciones.findOne(id);
  }

  /**
   * Finalizar asignación (horaFin=ahora CDMX, activa=false)
   */
  @Patch(':id/finalizar')
  finalizar(@Param('id', ParseIntPipe) id: number) {
    return this.asignaciones.finalizar(id);
  }
}