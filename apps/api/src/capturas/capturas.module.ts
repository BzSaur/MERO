import { Module } from '@nestjs/common';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';
import { MetricasModule } from '../metricas/metricas.module';

@Module({
  imports: [MetricasModule],
  controllers: [CapturasController],
  providers: [CapturasService],
  exports: [CapturasService],
})
export class CapturasModule {}
