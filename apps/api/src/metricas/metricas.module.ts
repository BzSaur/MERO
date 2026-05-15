import { Module } from '@nestjs/common';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { EmpleadosModule } from '../empleados/empleados.module';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';
import { MetricasSseService } from './metricas-sse.service';

@Module({
  imports: [CatalogosModule, EmpleadosModule],
  controllers: [MetricasController],
  providers: [MetricasService, MetricasSseService],
  exports: [MetricasService, MetricasSseService],
})
export class MetricasModule {}