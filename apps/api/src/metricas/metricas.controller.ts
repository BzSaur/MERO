import {
  Controller,
  Get,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MetricasService } from './metricas.service';
import { MetricasSseService } from './metricas-sse.service';

@Controller('metricas')
@UseGuards(JwtAuthGuard)
export class MetricasController {
  constructor(
    private readonly service: MetricasService,
    private readonly sse: MetricasSseService,
  ) {}

  /** Métricas por hora para una fecha y área */
  @Get('hora')
  getMetricasHora(
    @Query('fecha') fecha: string,
    @Query('areaId') areaId?: number,
  ) {
    return this.service.getMetricasHora(fecha, areaId);
  }

  /** Métricas agregadas del día */
  @Get('dia')
  getMetricasDia(
    @Query('fecha') fecha: string,
    @Query('areaId') areaId?: number,
  ) {
    return this.service.getMetricasDia(fecha, areaId);
  }

  /** Histórico con filtros */
  @Get('historico')
  getHistorico(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('areaId') areaId?: number,
    @Query('subtareaId') subtareaId?: number,
    @Query('modeloId') modeloId?: number,
  ) {
    return this.service.getHistorico(desde, hasta, areaId, subtareaId, modeloId);
  }

  /** Stream SSE de métricas en tiempo real */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.sse.getStream();
  }
}
