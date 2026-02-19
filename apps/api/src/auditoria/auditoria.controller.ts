import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  findAll(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('usuarioId') usuarioId?: number,
    @Query('tabla') tabla?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({
      desde,
      hasta,
      usuarioId,
      tabla,
      limit: limit ?? 100,
    });
  }
}
