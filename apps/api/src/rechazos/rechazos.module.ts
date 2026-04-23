import { Module } from '@nestjs/common';
import { RechazosController } from './rechazos.controller';
import { RechazosService } from './rechazos.service';

@Module({
  controllers: [RechazosController],
  providers: [RechazosService],
  exports: [RechazosService],
})
export class RechazosModule {}
