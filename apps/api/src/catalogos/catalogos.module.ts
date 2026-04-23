import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { SubtareasController } from './subtareas.controller';
import { SubtareasService } from './subtareas.service';
import { ModelosController } from './modelos.controller';
import { ModelosService } from './modelos.service';
import { EstandaresController } from './estandares.controller';
import { EstandaresService } from './estandares.service';
import { ActividadesIndirectasController } from './actividades-indirectas.controller';
import { ActividadesIndirectasService } from './actividades-indirectas.service';

@Module({
  controllers: [
    AreasController,
    SubtareasController,
    ModelosController,
    EstandaresController,
    ActividadesIndirectasController,
  ],
  providers: [
    AreasService,
    SubtareasService,
    ModelosService,
    EstandaresService,
    ActividadesIndirectasService,
  ],
  exports: [EstandaresService, ActividadesIndirectasService],
})
export class CatalogosModule {}