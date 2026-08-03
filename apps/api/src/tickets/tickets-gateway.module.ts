import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TicketsGateway } from './tickets.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [TicketsGateway],
  exports: [TicketsGateway],
})
export class TicketsGatewayModule {}
