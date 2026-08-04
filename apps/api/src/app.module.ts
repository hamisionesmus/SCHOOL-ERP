import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { UserDirectoryModule } from './common/user-directory/user-directory.module';
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
import { UploadsModule } from './uploads/uploads.module';
import { SettingsModule } from './settings/settings.module';
import { TripsModule } from './trips/trips.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BiometricModule } from './biometric/biometric.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BillingModule } from './platform/billing/billing.module';
import { BackupsModule } from './platform/backups/backups.module';
import { SickSheetsModule } from './sick-sheets/sick-sheets.module';
import { CalendarModule } from './calendar/calendar.module';
import { SecurityModule } from './platform/security/security.module';
import { AnalyticsModule } from './platform/analytics/analytics.module';
import { AuditLogAccessModule } from './platform/audit-log-access/audit-log-access.module';
import { ActivationModule } from './platform/activation/activation.module';
import { PlatformSettingsModule } from './platform/platform-settings/platform-settings.module';
import { SettingsOtpModule } from './platform/settings-otp/settings-otp.module';
import { FeedbackModule } from './platform/feedback/feedback.module';
import { RemindersModule } from './platform/reminders/reminders.module';
import { BrandingModule } from './platform/branding/branding.module';
import { MeModule } from './platform/me/me.module';
import { PlatformAdminsModule } from './platform/admins/admins.module';
import { PlatformNotificationsModule } from './platform/notifications/platform-notifications.module';
import { TicketsModule } from './tickets/tickets.module';
import { PlatformTicketsModule } from './platform/tickets/platform-tickets.module';
import { PlatformFinanceModule } from './platform/finance/finance.module';
import { PricingTiersModule } from './platform/pricing-tiers/pricing-tiers.module';
import { SystemHealthModule } from './platform/system-health/system-health.module';
import { MailboxesModule } from './platform/mailboxes/mailboxes.module';
import { PresenceModule } from './platform/presence/presence.module';
import { tenantOrIpTracker } from './common/guards/tenant-throttle-tracker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 'default' (unnamed) throttler is IP-keyed as before — protects against a single abusive IP.
    // 'tenant' is keyed by tenantSchema for authenticated tenant-realm requests (see
    // tenant-throttle-tracker.ts) — protects against one school's traffic spike starving another
    // school sharing this same API process, which IP-keying alone can't do (many different parent/
    // staff IPs at one busy school would otherwise each get their own separate budget). Both apply
    // simultaneously; a request only needs to pass both to proceed.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 120 },
      { name: 'tenant', ttl: 60000, limit: 300, getTracker: tenantOrIpTracker },
    ]),
    PrismaModule,
    UserDirectoryModule,
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
    UploadsModule,
    SettingsModule,
    TripsModule,
    DashboardModule,
    BiometricModule,
    NotificationsModule,
    BillingModule,
    BackupsModule,
    SickSheetsModule,
    CalendarModule,
    SecurityModule,
    AnalyticsModule,
    AuditLogAccessModule,
    ActivationModule,
    PlatformSettingsModule,
    SettingsOtpModule,
    FeedbackModule,
    RemindersModule,
    BrandingModule,
    MeModule,
    PlatformAdminsModule,
    PlatformNotificationsModule,
    TicketsModule,
    PlatformTicketsModule,
    PlatformFinanceModule,
    PricingTiersModule,
    SystemHealthModule,
    MailboxesModule,
    PresenceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
