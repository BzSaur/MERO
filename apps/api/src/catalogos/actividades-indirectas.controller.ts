import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ActividadesIndirectasService,
  CreateActividadIndirectaDto,
  UpdateActividadIndirectaDto,
} from './actividades-indirectas.service';

@Controller('catalogos/actividades-indirectas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActividadesIndirectasController {
  constructor(private readonly service: ActividadesIndirectasService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateActividadIndirectaDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('todas')
  @Roles('ADMIN')
  findAllIncludeInactivas() {
    return this.service.findAllIncludeInactivas();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActividadIndirectaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
