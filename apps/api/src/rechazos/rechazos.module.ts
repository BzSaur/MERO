import { Module } from '@nestjs/common';
import { RechazosController } from './rechazos.controller';
import { RechazosService } from './rechazos.service';
import { MetricasModule } from '../metricas/metricas.module';

@Module({
  imports: [MetricasModule],
  controllers: [RechazosController],
  providers: [RechazosService],
  exports: [RechazosService],
})
export class RechazosModule {}
