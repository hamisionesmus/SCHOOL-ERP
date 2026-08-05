import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface TraineeTokenPayload {
  purpose: 'trainee-portal';
  traineeId: string;
}

/** A lightweight, dedicated auth path for the trainee self-service portal — deliberately separate
 * from the platform/tenant JwtAuthGuard+passport strategy (which assumes a PlatformUser/tenant User
 * identity) since a HamzoneTrainee is neither. Same manual verify-and-attach pattern as
 * ActivationService's token handling: reads `Authorization: Bearer <token>`, verifies with the same
 * JWT_ACCESS_SECRET, requires `purpose: 'trainee-portal'`, and sets req.trainee. */
@Injectable()
export class TraineeAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    const token = authHeader.slice('Bearer '.length);
    try {
      const decoded = await this.jwt.verifyAsync<TraineeTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (decoded.purpose !== 'trainee-portal') throw new Error('Wrong token purpose');
      request.trainee = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session — please log in again');
    }
  }
}
