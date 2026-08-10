export type MessageTemplateKey =
  | 'OTP_SUPERADMIN'
  | 'OTP_ADMIN'
  | 'WELCOME_DEMO'
  | 'WELCOME_REAL'
  | 'ACTIVATED'
  | 'PROOF_SUBMITTED_SUPERADMIN'
  | 'PROOF_RECEIVED_SCHOOL'
  | 'DEMO_REMINDER'
  | 'RENEWAL_REMINDER'
  | 'SETTINGS_OTP'
  | 'SUB_ADMIN_WELCOME'
  | 'TICKET_ESCALATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_RESOLVED'
  | 'TICKET_FEEDBACK_RECEIVED'
  | 'TRAINER_WELCOME'
  | 'GIG_WORKER_WELCOME'
  | 'MEETING_INVITE'
  | 'MEETING_THANK_YOU'
  | 'MEETING_ABSENT_FOLLOWUP'
  | 'JOB_INTERVIEW_SCHEDULED'
  | 'JOB_HIRED'
  | 'JOB_REJECTED'
  | 'DAILY_TRAINING_LINK'
  | 'TRAINEE_PORTAL_WELCOME'
  | 'LEAD_FOLLOWUP_DUE';

export interface MessageTemplateContent {
  subject?: string;
  emailBody?: string;
  smsBody?: string;
  /** Documented for the Settings UI — which {{vars}} this template can use. Not enforced at runtime. */
  variables: string[];
}

/**
 * The built-in copy for every message the platform sends. This is the fallback a
 * PlatformMessageTemplate row overrides — always present, never deleted, so "reset to default"
 * just means "no customized row" (see PlatformNotifierService).
 */
export const DEFAULT_TEMPLATES: Record<MessageTemplateKey, MessageTemplateContent> = {
  OTP_SUPERADMIN: {
    variables: ['schoolName', 'slug', 'code', 'demoNote', 'requestedByName'],
    subject: 'Confirm school creation: {{schoolName}}',
    emailBody:
      'A request to create "{{schoolName}}" ({{slug}}){{demoNote}} was made by {{requestedByName}}. If this is expected, enter code {{code}} to confirm. It expires in 15 minutes. If you didn\'t expect this, ignore this message — nothing is created until the code is confirmed.',
    smsBody:
      'Hamzone Technologies: {{requestedByName}} requested to create "{{schoolName}}" — confirm with code {{code}}. Expires in 15 min. Ignore if unexpected.',
  },
  OTP_ADMIN: {
    variables: ['schoolName', 'otpCode', 'creatorLabel', 'systemName'],
    subject: 'Welcome to {{systemName}} — confirm you\'re the admin for {{schoolName}}',
    emailBody:
      'Welcome to {{systemName}}!\n\n{{creatorLabel}} is setting up "{{schoolName}}" and named you as its administrator. Your verification code is {{otpCode}} — give it to them to confirm it\'s really you and that you consent. It expires in 15 minutes.\n\nIf you didn\'t expect this, you can safely ignore this message — nothing is created without your code.',
    smsBody:
      'Welcome to Hamzone Technologies! {{creatorLabel}} is setting up "{{schoolName}}" and named you as its administrator. Your code is {{otpCode}} — give it to them to confirm it\'s really you. Expires in 15 min. Ignore if unexpected.',
  },
  WELCOME_DEMO: {
    variables: ['schoolName', 'loginUrl', 'email', 'tempPassword', 'expiryDate', 'systemName'],
    subject: 'Welcome to your {{systemName}} demo — {{schoolName}}',
    emailBody:
      'Welcome to your {{systemName}} demo!\n\n"{{schoolName}}" is ready to explore, no payment needed.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change this password once you sign in.\n\nThis demo runs until {{expiryDate}} — after that, sign-in will be paused until you extend it or move to a full account. Enjoy exploring!',
    smsBody:
      'Welcome to your Hamzone Technologies demo! "{{schoolName}}" is ready. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}}. Runs until {{expiryDate}}.',
  },
  WELCOME_REAL: {
    variables: ['schoolName', 'activationUrl', 'amountKes', 'loginUrl', 'slug', 'email', 'systemName'],
    subject: 'Welcome to {{systemName}} — activate {{schoolName}}',
    emailBody:
      'Welcome to {{systemName}}! "{{schoolName}}" has been created — one step left before you can sign in.\n\nActivate now: {{activationUrl}}\nAmount due: KES {{amountKes}}\n\nYou can pay instantly by M-Pesa STK Push, or by Bank transfer / Paybill — bank and paybill payments take a little longer to confirm, so after paying that way just paste the confirmation message you receive on the activation page and we\'ll verify it and unlock your account.\n\nOnce payment is confirmed you\'ll get another message with your login details.\nSchool code: {{slug}}\nAdmin email: {{email}}\n\nThis is an automated message from a no-reply address — please don\'t reply to it.',
    smsBody:
      'Welcome to Hamzone Technologies! "{{schoolName}}" has been created. Activate now (KES {{amountKes}}): {{activationUrl}} — pay by M-Pesa, bank, or paybill. Your login details follow once payment is confirmed.',
  },
  ACTIVATED: {
    variables: ['schoolName', 'loginUrl', 'email', 'tempPassword', 'receiptNumber', 'methodNote', 'amountKes'],
    subject: '{{schoolName}} is now active — you can sign in',
    emailBody:
      'Thank you for choosing us! Your payment has been received and "{{schoolName}}" is now active.\n\nHere are your logins:\nSign in at {{loginUrl}}\nEmail: {{email}}\nPassword: {{tempPassword}}\n\nPlease change this password as soon as you sign in — write it down or save it somewhere safe until then.\n\nReceipt: {{receiptNumber}} ({{methodNote}})\nAmount: KES {{amountKes}}\n\nThis is an automated message from a no-reply address — please don\'t reply to it.',
    smsBody:
      'Payment received! "{{schoolName}}" is now active. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}} (please change it once in). Receipt {{receiptNumber}}. Thank you for choosing us!',
  },
  PROOF_SUBMITTED_SUPERADMIN: {
    variables: ['schoolName', 'methodLabel', 'reference', 'amountKes'],
    subject: 'Payment proof submitted — {{schoolName}}',
    emailBody:
      '"{{schoolName}}" submitted a {{methodLabel}} payment confirmation for review.\n\n{{reference}}{{amountKes}}\nReview and approve/reject it from the school\'s Billing tab in your dashboard.',
    smsBody: 'Hamzone Technologies: "{{schoolName}}" submitted a {{methodLabel}} payment proof — review it in the dashboard.',
  },
  PROOF_RECEIVED_SCHOOL: {
    variables: ['schoolName', 'methodLabel'],
    subject: 'We received your payment confirmation — {{schoolName}}',
    emailBody:
      'Thanks — we\'ve received your {{methodLabel}} payment confirmation for "{{schoolName}}" and are verifying it now. Bank and paybill payments can take a little longer to confirm than M-Pesa. You\'ll be notified the moment it\'s confirmed and your school is unlocked. If you don\'t hear back or run into an issue, please contact support.',
    smsBody:
      'Hamzone Technologies: we received your payment confirmation for "{{schoolName}}" and are verifying it — this can take a little time. You\'ll be notified once confirmed.',
  },
  DEMO_REMINDER: {
    variables: ['schoolName', 'daysLeft', 'expiryDate', 'surveyUrl'],
    subject: 'Your "{{schoolName}}" demo ends soon',
    emailBody:
      'Your School ERP demo for "{{schoolName}}" ends in {{daysLeft}} day(s), on {{expiryDate}}.\n\nEnjoying it so far? We\'d love your feedback — it only takes a minute: {{surveyUrl}}\n\nReady to keep going? Get in touch to move to a full account and keep everything you\'ve set up.',
    smsBody:
      'Hamzone Technologies: your "{{schoolName}}" demo ends in {{daysLeft}} day(s) ({{expiryDate}}). Quick feedback: {{surveyUrl}}',
  },
  RENEWAL_REMINDER: {
    variables: ['schoolName', 'daysLeft', 'renewalDate'],
    subject: '"{{schoolName}}" renews soon',
    emailBody:
      'Your current billing period for "{{schoolName}}" ends in {{daysLeft}} day(s), on {{renewalDate}}. To avoid any interruption, please get in touch to arrange your next payment.',
    smsBody: 'Hamzone Technologies: "{{schoolName}}" renews in {{daysLeft}} day(s) ({{renewalDate}}). Contact us to renew.',
  },
  SETTINGS_OTP: {
    variables: ['code', 'operation', 'requestedByName'],
    subject: 'Confirm: {{operation}}',
    emailBody:
      '{{requestedByName}} requested to {{operation}}. If this was you, enter code {{code}} to confirm. It expires in 15 minutes. If you didn\'t request this, ignore this message — nothing changes until the code is confirmed.',
    smsBody: 'Hamzone Technologies: {{requestedByName}} requested to {{operation}}. Confirm with code {{code}}. Expires in 15 min.',
  },
  SUB_ADMIN_WELCOME: {
    variables: ['fullName', 'loginUrl', 'email', 'tempPassword', 'invitedByName', 'capabilities', 'systemName'],
    subject: 'You\'ve been added as a {{systemName}} admin',
    emailBody:
      'Hi {{fullName}},\n\n{{invitedByName}} has added you as an admin on {{systemName}}. {{capabilities}} Other administrative areas stay with the account owner.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change your password as soon as you sign in.',
    smsBody:
      'Hamzone Technologies: {{invitedByName}} added you as an admin. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}} (please change it once in).',
  },
  TICKET_ESCALATED: {
    variables: ['schoolName', 'subject', 'priority', 'escalationReason', 'dashboardUrl'],
    subject: 'Ticket escalated — {{schoolName}}',
    emailBody:
      '"{{schoolName}}" escalated a support ticket that needs platform attention.\n\nSubject: {{subject}}\nPriority: {{priority}}\nWhy it was escalated: {{escalationReason}}\n\nReview and resolve or assign it here: {{dashboardUrl}}',
    smsBody:
      'Hamzone Technologies: "{{schoolName}}" escalated a ticket ({{priority}} priority) — "{{subject}}". Review at {{dashboardUrl}}',
  },
  TICKET_ASSIGNED: {
    variables: ['schoolName', 'subject', 'priority', 'dashboardUrl'],
    subject: 'Ticket assigned to you — {{schoolName}}',
    emailBody:
      'You\'ve been assigned an escalated support ticket from "{{schoolName}}".\n\nSubject: {{subject}}\nPriority: {{priority}}\n\nView and resolve it here: {{dashboardUrl}}',
    smsBody: 'Hamzone Technologies: you\'ve been assigned a ticket from "{{schoolName}}" — "{{subject}}". {{dashboardUrl}}',
  },
  TICKET_RESOLVED: {
    variables: ['subject', 'resolutionNote', 'surveyUrl'],
    subject: 'Your support ticket has been resolved — {{subject}}',
    emailBody:
      'Your support ticket "{{subject}}" has been resolved.\n\n{{resolutionNote}}\n\nWe\'d love to know how we did — it only takes a minute: {{surveyUrl}}',
    smsBody: 'Hamzone Technologies: your ticket "{{subject}}" has been resolved. Quick feedback: {{surveyUrl}}',
  },
  TICKET_FEEDBACK_RECEIVED: {
    variables: ['schoolName', 'subject', 'rating', 'dashboardUrl'],
    subject: 'New ticket feedback — {{schoolName}}',
    emailBody:
      '"{{schoolName}}" left feedback on their resolved ticket "{{subject}}": {{rating}}/5.\n\nView it here: {{dashboardUrl}}',
    smsBody: 'Hamzone Technologies: "{{schoolName}}" rated their resolved ticket "{{subject}}" {{rating}}/5 — view in dashboard.',
  },
  TRAINER_WELCOME: {
    variables: ['fullName', 'loginUrl', 'email', 'tempPassword', 'centerName', 'track'],
    subject: 'Welcome to the Hamzone Technologies training team',
    emailBody:
      'Hi {{fullName}},\n\nYou\'ve been added as a trainer on our training portal{{centerName}}{{track}}.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nFrom there you can log your daily register, submit progress reports, and see any resources or meetings shared with trainers. Please change your password as soon as you sign in.',
    smsBody:
      'Hamzone Technologies: you\'ve been added as a trainer. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}} (please change it once in).',
  },
  GIG_WORKER_WELCOME: {
    variables: ['fullName', 'loginUrl', 'email', 'tempPassword', 'invitedByName'],
    subject: 'Your account is ready',
    emailBody:
      'Hi {{fullName}},\n\n{{invitedByName}} has set up an account for you to report on the work you\'ve been assigned.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nFrom there you can see what\'s been assigned to you and log your earnings and any challenges. Please change your password as soon as you sign in.',
    smsBody:
      'Hamzone Technologies: your account is ready. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}} (please change it once in).',
  },
  MEETING_INVITE: {
    variables: ['title', 'scheduledAt', 'meetingLink', 'organizerName', 'agendaList', 'rosterList', 'joinUrl'],
    subject: 'Meeting scheduled: {{title}}',
    emailBody:
      '{{organizerName}} scheduled a meeting you\'re invited to.\n\n{{title}}\nWhen: {{scheduledAt}}\n\nAgenda:\n{{agendaList}}\n\nWho else to expect:\n{{rosterList}}\n\nJoin using the link below — it only becomes active once the scheduled time arrives, and it\'s tied to the email address you were invited with, so opening it marks you present automatically. If it asks you to confirm your email, please use the exact one this invite was sent to.\n\n{{joinUrl}}',
    smsBody: 'Hamzone Technologies: meeting "{{title}}" at {{scheduledAt}}. Join (marks you present): {{joinUrl}}',
  },
  MEETING_THANK_YOU: {
    variables: ['title', 'scheduledAt'],
    subject: 'Thank you for attending — {{title}}',
    emailBody:
      'Thank you for attending "{{title}}" ({{scheduledAt}}) — our records show you were present. We appreciate you being there.',
    smsBody: 'Hamzone Technologies: thank you for attending "{{title}}" ({{scheduledAt}}).',
  },
  MEETING_ABSENT_FOLLOWUP: {
    variables: ['title', 'scheduledAt', 'joinUrl'],
    subject: 'Action needed within 30 minutes — recorded absent for {{title}}',
    emailBody:
      'Our records show you were absent for "{{title}}" held {{scheduledAt}}.\n\nIf you did actually attend — perhaps using a different email than the one this was sent to — you can confirm the email you joined with here and we\'ll mark you present: {{joinUrl}}\n\nIf you weren\'t able to make it, the same link lets you give a reason.\n\nThis link expires in 30 minutes — please respond now, because the meeting minutes are being finalized. If we don\'t hear from you in time, you\'ll remain marked absent.',
    smsBody:
      'Hamzone Technologies: recorded absent for "{{title}}" ({{scheduledAt}}). Respond within 30 min or you stay marked absent — minutes are being finalized: {{joinUrl}}',
  },
  JOB_INTERVIEW_SCHEDULED: {
    variables: ['fullName', 'positionTitle', 'interviewAt', 'notes'],
    subject: 'Interview scheduled — {{positionTitle}}',
    emailBody:
      'Hi {{fullName}},\n\nThanks for applying for {{positionTitle}} at Hamzone Technologies. We\'d like to invite you for an interview on {{interviewAt}}.\n\n{{notes}}\n\nPlease reply to confirm you\'ll be able to make it.',
    smsBody: 'Hamzone Technologies: your interview for {{positionTitle}} is scheduled for {{interviewAt}}. Check your email for details.',
  },
  JOB_HIRED: {
    variables: ['fullName', 'positionTitle', 'loginUrl', 'email', 'tempPassword'],
    subject: 'Congratulations — welcome to Hamzone Technologies!',
    emailBody:
      'Hi {{fullName}},\n\nCongratulations — you\'ve been selected for {{positionTitle}}! We\'re excited to have you on the team.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change your password as soon as you sign in — you\'ll need to before you can access anything else. Once in, check your assigned tasks to get started.',
    smsBody: 'Hamzone Technologies: Congratulations! You\'ve been hired for {{positionTitle}}. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}}.',
  },
  JOB_REJECTED: {
    variables: ['fullName', 'positionTitle'],
    subject: 'Update on your application — {{positionTitle}}',
    emailBody:
      'Hi {{fullName}},\n\nThank you for your interest in {{positionTitle}} and for taking the time to apply/interview with us. We\'ve decided to move forward with other candidates for this particular role. We appreciate your interest in Hamzone Technologies and encourage you to apply again in the future.',
    smsBody: 'Hamzone Technologies: thank you for applying for {{positionTitle}}. We\'ve moved forward with other candidates this time. Check your email for details.',
  },
  DAILY_TRAINING_LINK: {
    variables: ['fullName', 'programTitle', 'date', 'link'],
    subject: 'Today\'s training link — {{programTitle}}',
    emailBody:
      'Hi {{fullName}},\n\nHere\'s today\'s link ({{date}}) to record attendance and progress for {{programTitle}}:\n\n{{link}}\n\nThis link works only for today — a new one is generated and sent automatically each training day.',
    smsBody: 'Hamzone: today\'s ({{date}}) register link for {{programTitle}}: {{link}} — valid today only.',
  },
  TRAINEE_PORTAL_WELCOME: {
    variables: ['fullName', 'programTitle', 'loginUrl', 'email', 'tempPassword'],
    subject: 'Your training portal is ready',
    emailBody:
      'Hi {{fullName}},\n\nYou now have access to your own portal for {{programTitle}} — check your attendance and see shared learning materials any time.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change your password once you sign in.',
    smsBody: 'Hamzone Technologies: your training portal is ready. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}}.',
  },
  LEAD_FOLLOWUP_DUE: {
    variables: ['clientName', 'interest', 'dashboardUrl'],
    subject: 'Follow-up due — {{clientName}}',
    emailBody:
      'The follow-up date you set for lead "{{clientName}}" ({{interest}}) has arrived. Give them a call or check in, then update their status in the CRM: {{dashboardUrl}}',
    smsBody: 'Hamzone Technologies: follow-up due for lead "{{clientName}}" ({{interest}}) — check the CRM.',
  },
};
