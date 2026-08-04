import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestMetricsService } from './request-metrics.service';

@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: RequestMetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    this.metrics.recordRequest();
    res.on('finish', () => this.metrics.recordResponse(res.statusCode));
    next();
  }
}
