import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AsignacionesService, ScanIndirectaDto } from './asignaciones.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@UseGuards(JwtAuthGuard)
@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Post('scan')
  scan(@Body() dto: ScanQrDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.asignaciones.scan(dto, user.id);
  }

  @Post('scan-indirecta')
  scanIndirecta(@Body() dto: ScanIndirectaDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.asignaciones.scanIndirecta(dto, user.id);
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