import { Module } from '@nestjs/common';
import { PlatformMpesaService } from './mpesa.service';

@Module({
  providers: [PlatformMpesaService],
  exports: [PlatformMpesaService],
})
export class PlatformMpesaModule {}
