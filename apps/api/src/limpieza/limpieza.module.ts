import { Module } from '@nestjs/common';
import { LimpiezaService } from './limpieza.service';

@Module({
  providers: [LimpiezaService],
})
export class LimpiezaModule {}
