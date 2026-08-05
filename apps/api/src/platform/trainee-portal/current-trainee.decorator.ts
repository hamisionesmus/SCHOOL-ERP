import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TraineeTokenPayload } from './trainee-auth.guard';

export const CurrentTrainee = createParamDecorator((_data: unknown, ctx: ExecutionContext): TraineeTokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.trainee;
});
