import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { RecordMovementDto } from './dto/record-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createItem(user: JwtUserPayload, dto: CreateItemDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.inventoryItem.create({ data: { ...dto, reorderLevel: dto.reorderLevel ?? 0 } });
  }

  async listItems(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  }

  async recordMovement(user: JwtUserPayload, itemId: string, dto: RecordMovementDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    if (dto.type === 'OUT' && dto.quantity > item.quantity) {
      throw new BadRequestException(`Cannot remove ${dto.quantity}; only ${item.quantity} in stock`);
    }

    const [movement] = await db.$transaction([
      db.stockMovement.create({
        data: { itemId, type: dto.type, quantity: dto.quantity, reason: dto.reason, recordedByUserId: user.sub },
      }),
      db.inventoryItem.update({
        where: { id: itemId },
        data:
          dto.type === 'IN'
            ? { quantity: { increment: dto.quantity } }
            : { quantity: { decrement: dto.quantity } },
      }),
    ]);
    return movement;
  }

  async listMovements(user: JwtUserPayload, itemId?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.stockMovement.findMany({
      where: itemId ? { itemId } : undefined,
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
