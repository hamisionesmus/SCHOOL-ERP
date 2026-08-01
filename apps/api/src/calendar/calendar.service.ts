import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { renderCalendarPdf } from './calendar-pdf.util';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startDate: Date;
  endDate: Date | null;
  allDay: boolean;
  /** 'custom' entries can be deleted via this module; 'trip'/'exam' are read-only reflections of
   * data owned by those modules — the calendar doesn't duplicate storage for them. */
  source: 'custom' | 'trip' | 'exam';
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  /** Merges custom SchoolEvent entries with Trip and Exam dates into one read model — a school's
   * calendar shouldn't need staff to re-enter dates that already exist elsewhere in the app. */
  async list(user: JwtUserPayload): Promise<CalendarEvent[]> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const [custom, trips, exams] = await Promise.all([
      db.schoolEvent.findMany({ orderBy: { startDate: 'asc' } }),
      db.trip.findMany({ where: { status: { in: ['APPROVED', 'COMPLETED'] } } }),
      db.exam.findMany(),
    ]);

    const events: CalendarEvent[] = [
      ...custom.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        startDate: e.startDate,
        endDate: e.endDate,
        allDay: e.allDay,
        source: 'custom' as const,
      })),
      ...trips.map((t) => ({
        id: `trip-${t.id}`,
        title: t.title,
        description: t.destination,
        category: 'TRIP',
        startDate: t.tripDate,
        endDate: null,
        allDay: true,
        source: 'trip' as const,
      })),
      ...exams.map((e) => ({
        id: `exam-${e.id}`,
        title: e.name,
        description: null,
        category: 'EXAM',
        startDate: e.startDate,
        endDate: e.endDate,
        allDay: true,
        source: 'exam' as const,
      })),
    ];

    return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  async create(user: JwtUserPayload, dto: CreateEventDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.schoolEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        allDay: dto.allDay ?? true,
        createdByUserId: user.sub,
      },
    });
  }

  async remove(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const event = await db.schoolEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    await db.schoolEvent.delete({ where: { id } });
    return { ok: true };
  }

  async monthPdf(user: JwtUserPayload, year: number, month: number): Promise<{ buffer: Buffer; filename: string }> {
    if (month < 0 || month > 11) throw new ForbiddenException('Invalid month');
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { schemaName: user.tenantSchema! } });
    const events = await this.list(user);
    const inMonth = events.filter(
      (e) => e.startDate.getFullYear() === year && e.startDate.getMonth() === month,
    );

    const buffer = await renderCalendarPdf({
      school: { name: tenant?.name ?? 'School' },
      year,
      month,
      events: inMonth,
    });

    return { buffer, filename: `Calendar_${year}-${String(month + 1).padStart(2, '0')}.pdf` };
  }

  /** Minimal iCalendar (RFC 5545) export — plain text, no external library needed. Importable into
   * Google Calendar / Outlook / Apple Calendar. */
  async ics(user: JwtUserPayload): Promise<string> {
    const events = await this.list(user);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//School ERP//Calendar//EN'];
    for (const e of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@school-erp`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(e.startDate)}`,
        `DTEND:${fmt(e.endDate ?? new Date(e.startDate.getTime() + 86_400_000))}`,
        `SUMMARY:${e.title.replace(/\n/g, ' ')}`,
        ...(e.description ? [`DESCRIPTION:${e.description.replace(/\n/g, ' ')}`] : []),
        `CATEGORIES:${e.category}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}
