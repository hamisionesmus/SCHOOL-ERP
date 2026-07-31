import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { RecordMovementDto } from './dto/record-movement.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('INVENTORY:MANAGE')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  listItems(@CurrentUser() user: JwtUserPayload) {
    return this.inventoryService.listItems(user);
  }

  @Post('items')
  createItem(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateItemDto) {
    return this.inventoryService.createItem(user, dto);
  }

  @Get('movements')
  listMovements(@CurrentUser() user: JwtUserPayload, @Query('itemId') itemId?: string) {
    return this.inventoryService.listMovements(user, itemId);
  }

  @Post('items/:id/movements')
  recordMovement(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: RecordMovementDto,
  ) {
    return this.inventoryService.recordMovement(user, id, dto);
  }
}
