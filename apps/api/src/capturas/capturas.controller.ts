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
import { CapturasService } from './capturas.service';
import { CreateCapturaDto } from './dto/create-captura.dto';

@Controller('capturas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CapturasController {
  constructor(private readonly service: CapturasService) {}

  @Post()
  @Roles('ADMIN', 'ENCARGADO')
  create(@Body() dto: CreateCapturaDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.create(dto, user.id);
  }

  @Get('asignacion/:asignacionId')
  findByAsignacion(@Param('asignacionId', ParseIntPipe) asignacionId: number) {
    return this.service.findByAsignacion(asignacionId);
  }
}
