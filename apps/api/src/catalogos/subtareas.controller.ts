import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubtareasService } from './subtareas.service';
import { CreateSubtareaDto } from './dto/create-subtarea.dto';
import { UpdateSubtareaDto } from './dto/update-subtarea.dto';

@Controller('catalogos/subtareas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubtareasController {
  constructor(private readonly service: SubtareasService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateSubtareaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubtareaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
