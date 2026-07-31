import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TransportService } from './transport.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { AssignTransportDto } from './dto/assign-transport.dto';

@ApiTags('transport')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get('vehicles')
  listVehicles(@CurrentUser() user: JwtUserPayload) {
    return this.transportService.listVehicles(user);
  }

  @Post('vehicles')
  @RequirePermission('TRANSPORT:MANAGE')
  createVehicle(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateVehicleDto) {
    return this.transportService.createVehicle(user, dto);
  }

  @Get('routes')
  listRoutes(@CurrentUser() user: JwtUserPayload) {
    return this.transportService.listRoutes(user);
  }

  @Post('routes')
  @RequirePermission('TRANSPORT:MANAGE')
  createRoute(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateRouteDto) {
    return this.transportService.createRoute(user, dto);
  }

  @Get('assignments')
  listAssignments(@CurrentUser() user: JwtUserPayload) {
    return this.transportService.listAssignments(user);
  }

  @Post('assignments')
  @RequirePermission('TRANSPORT:MANAGE')
  assignStudent(@CurrentUser() user: JwtUserPayload, @Body() dto: AssignTransportDto) {
    return this.transportService.assignStudent(user, dto);
  }
}
