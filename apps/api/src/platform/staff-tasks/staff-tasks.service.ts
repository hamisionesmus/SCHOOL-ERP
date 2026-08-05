import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { UpsertStaffTaskDto } from './dto/upsert-staff-task.dto';

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, fullName: true, role: true, jobTitle: true } },
  assignedBy: { select: { id: true, fullName: true } },
} as const;

/** A concrete assignment for hired staff ("software engineers... which repo, which task") — see
 * HamzoneStaffTask's schema doc comment. Deliberately simple, no sprints/boards. */
@Injectable()
export class StaffTasksService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list(assignedToUserId?: string) {
    return this.platformPrisma.hamzoneStaffTask.findMany({
      where: assignedToUserId ? { assignedToUserId } : {},
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.platformPrisma.hamzoneStaffTask.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  create(dto: UpsertStaffTaskDto, assignedByUserId: string) {
    return this.platformPrisma.hamzoneStaffTask.create({
      data: {
        assignedToUserId: dto.assignedToUserId,
        title: dto.title,
        description: dto.description,
        repoUrl: dto.repoUrl,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedByUserId,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(id: string, dto: Partial<UpsertStaffTaskDto>) {
    await this.findOne(id);
    return this.platformPrisma.hamzoneStaffTask.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
      include: TASK_INCLUDE,
    });
  }

  /** Self-service status update for the assignee themselves — separate from the full admin
   * update() so a STAFF/SOFTWARE_ENGINEER account can move their own tasks along without needing
   * broader task-management access. */
  async updateOwnStatus(id: string, userId: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE') {
    const task = await this.findOne(id);
    if (task.assignedToUserId !== userId) {
      throw new NotFoundException('Task not found');
    }
    return this.platformPrisma.hamzoneStaffTask.update({ where: { id }, data: { status }, include: TASK_INCLUDE });
  }
}
