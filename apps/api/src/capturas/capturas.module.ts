import { Module } from '@nestjs/common';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';

@Module({
  controllers: [CapturasController],
  providers: [CapturasService],
  exports: [CapturasService],
})
export class CapturasModule {}
