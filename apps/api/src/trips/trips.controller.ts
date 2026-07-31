import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TripsService } from './trips.service';
import { ProposeTripDto } from './dto/propose-trip.dto';
import { RejectTripDto } from './dto/reject-trip.dto';
import { RegisterTripDto } from './dto/register-trip.dto';
import { PayTripDto } from './dto/pay-trip.dto';

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  listTrips(@CurrentUser() user: JwtUserPayload) {
    return this.tripsService.listTrips(user);
  }

  @Post()
  @RequirePermission('TRANSPORT:PROPOSE')
  propose(@CurrentUser() user: JwtUserPayload, @Body() dto: ProposeTripDto) {
    return this.tripsService.propose(user, dto);
  }

  @Patch(':id/approve')
  @RequirePermission('TRANSPORT:MANAGE')
  approve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.tripsService.approve(user, id);
  }

  @Patch(':id/reject')
  @RequirePermission('TRANSPORT:MANAGE')
  reject(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: RejectTripDto) {
    return this.tripsService.reject(user, id, dto);
  }

  @Post(':id/register')
  register(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: RegisterTripDto) {
    return this.tripsService.register(user, id, dto);
  }

  @Get('registrations')
  listRegistrations(@CurrentUser() user: JwtUserPayload, @Query('tripId') tripId?: string) {
    return this.tripsService.listRegistrations(user, tripId);
  }

  @Post('registrations/:id/pay')
  pay(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: PayTripDto) {
    return this.tripsService.pay(user, id, dto);
  }
}
