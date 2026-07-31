import { Module } from '@nestjs/common';
import { SubscriptionPlansController } from './subscription-plans.controller';

@Module({
  controllers: [SubscriptionPlansController],
})
export class SubscriptionPlansModule {}
