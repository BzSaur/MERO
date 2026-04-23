import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RechazosService, CreateRechazoDto } from './rechazos.service';

@Controller('rechazos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RechazosController {
  constructor(private readonly service: RechazosService) {}

  @Post()
  @Roles('ADMIN', 'ENCARGADO')
  create(@Body() dto: CreateRechazoDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.create(dto, user.id);
  }

  @Get('captura/:capturaId')
  findByCaptura(@Param('capturaId', ParseIntPipe) capturaId: number) {
    return this.service.findByCaptura(capturaId);
  }

  @Get('asignacion/:asignacionId')
  findByAsignacion(@Param('asignacionId', ParseIntPipe) asignacionId: number) {
    return this.service.findByAsignacion(asignacionId);
  }
}
