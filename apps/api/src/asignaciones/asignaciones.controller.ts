import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AsignacionesService } from './asignaciones.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@Controller('asignaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AsignacionesController {
  constructor(private readonly service: AsignacionesService) {}

  /** Escaneo de QR: crea o reasigna al empleado */
  @Post('scan')
  @Roles('ADMIN', 'ENCARGADO')
  scan(@Body() dto: ScanQrDto) {
    return this.service.scan(dto);
  }

  /** Asignaciones activas del día (opcional: filtrar por área) */
  @Get('activas')
  findActivas(@Query('areaId') areaId?: number) {
    return this.service.findActivas(areaId);
  }

  /** Histórico de asignaciones de un empleado */
  @Get('empleado/:empleadoId')
  findByEmpleado(
    @Param('empleadoId', ParseIntPipe) empleadoId: number,
    @Query('fecha') fecha?: string,
  ) {
    return this.service.findByEmpleado(empleadoId, fecha);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
