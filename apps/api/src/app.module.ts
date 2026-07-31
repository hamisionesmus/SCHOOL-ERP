import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './platform/tenants/tenants.module';
import { SubscriptionPlansModule } from './platform/subscription-plans/subscription-plans.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AcademicModule } from './academic/academic.module';
import { StudentsModule } from './students/students.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HomeworkModule } from './homework/homework.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { SubjectsModule } from './subjects/subjects.module';
import { ExamsModule } from './exams/exams.module';
import { CommunicationsModule } from './communications/communications.module';
import { FinanceModule } from './finance/finance.module';
import { LibraryModule } from './library/library.module';
import { TransportModule } from './transport/transport.module';
import { InventoryModule } from './inventory/inventory.module';
import { HealthModule } from './health/health.module';
import { DisciplineModule } from './discipline/discipline.module';
import { HrModule } from './hr/hr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    TenantsModule,
    SubscriptionPlansModule,
    UsersModule,
    RolesModule,
    AcademicModule,
    StudentsModule,
    AttendanceModule,
    HomeworkModule,
    AdmissionsModule,
    SubjectsModule,
    ExamsModule,
    CommunicationsModule,
    FinanceModule,
    LibraryModule,
    TransportModule,
    InventoryModule,
    HealthModule,
    DisciplineModule,
    HrModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
