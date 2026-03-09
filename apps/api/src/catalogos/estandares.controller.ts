import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EstandaresService } from './estandares.service';
import { CreateEstandarDto } from './dto/create-estandar.dto';
import { UpdateEstandarDto } from './dto/update-estandar.dto';

@Controller('catalogos/estandares')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstandaresController {
  constructor(private readonly service: EstandaresService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEstandarDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('vigente')
  findVigente(
    @Query('subtareaId', ParseIntPipe) subtareaId: number,
    @Query('modeloId', ParseIntPipe) modeloId: number,
  ) {
    return this.service.findVigente(subtareaId, modeloId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstandarDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}