import { Module } from '@nestjs/common';
import { ExternalContactsController } from './external-contacts.controller';
import { ExternalContactsService } from './external-contacts.service';

@Module({
  controllers: [ExternalContactsController],
  providers: [ExternalContactsService],
  exports: [ExternalContactsService],
})
export class ExternalContactsModule {}
