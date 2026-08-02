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
  | 'SETTINGS_OTP';

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
    variables: ['schoolName', 'slug', 'code', 'demoNote'],
    subject: 'Confirm school creation: {{schoolName}}',
    emailBody:
      'Someone requested to create "{{schoolName}}" ({{slug}}){{demoNote}} on your Super Admin account. If this was you, enter code {{code}} to confirm. It expires in 15 minutes. If you didn\'t request this, ignore this message — nothing is created until the code is confirmed.',
    smsBody:
      'School ERP: confirm creating "{{schoolName}}" with code {{code}}. Expires in 15 min. Ignore if this wasn\'t you.',
  },
  OTP_ADMIN: {
    variables: ['schoolName', 'otpCode'],
    smsBody:
      'School ERP: someone is setting you up as the administrator for "{{schoolName}}". Your verification code is {{otpCode}}. Give this to them to confirm it\'s really you — it expires in 15 minutes. Ignore if you didn\'t expect this.',
  },
  WELCOME_DEMO: {
    variables: ['schoolName', 'loginUrl', 'email', 'tempPassword', 'expiryDate'],
    subject: 'Welcome to your School ERP demo — {{schoolName}}',
    emailBody:
      'Welcome to your School ERP demo!\n\n"{{schoolName}}" is ready to explore, no payment needed.\n\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change this password once you sign in.\n\nThis demo runs until {{expiryDate}} — after that, sign-in will be paused until you extend it or move to a full account. Enjoy exploring!',
    smsBody:
      'Welcome to your School ERP demo! "{{schoolName}}" is ready. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}}. Runs until {{expiryDate}}.',
  },
  WELCOME_REAL: {
    variables: ['schoolName', 'activationUrl', 'amountKes', 'loginUrl', 'slug', 'email'],
    subject: 'Welcome to School ERP — activate {{schoolName}}',
    emailBody:
      'Welcome to School ERP! "{{schoolName}}" has been created — one step left before you can sign in.\n\nActivate now: {{activationUrl}}\nAmount due: KES {{amountKes}}\n\nYou can pay instantly by M-Pesa STK Push, or by Bank transfer / Paybill — bank and paybill payments take a little longer to confirm, so after paying that way just paste the confirmation message you receive on the activation page and we\'ll verify it and unlock your account.\n\nOnce payment is confirmed you\'ll get another message with your login details.\nSchool code: {{slug}}\nAdmin email: {{email}}\n\nThis is an automated message from a no-reply address — please don\'t reply to it.',
  },
  ACTIVATED: {
    variables: ['schoolName', 'loginUrl', 'email', 'tempPassword', 'receiptNumber', 'methodNote', 'amountKes'],
    subject: '{{schoolName}} is now active — you can sign in',
    emailBody:
      'Thank you for trusting us! Your payment has been received and "{{schoolName}}" is now active.\n\nHere are your logins:\nSign in at {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{tempPassword}}\n\nPlease change or reset this password as soon as you sign in.\n\nReceipt: {{receiptNumber}} ({{methodNote}})\nAmount: KES {{amountKes}}\n\nThis is an automated message from a no-reply address — please don\'t reply to it.',
    smsBody:
      'Payment received! "{{schoolName}}" is now active. Sign in at {{loginUrl}} with {{email}} / {{tempPassword}} (please change it). Receipt {{receiptNumber}}.',
  },
  PROOF_SUBMITTED_SUPERADMIN: {
    variables: ['schoolName', 'methodLabel', 'reference', 'amountKes'],
    subject: 'Payment proof submitted — {{schoolName}}',
    emailBody:
      '"{{schoolName}}" submitted a {{methodLabel}} payment confirmation for review.\n\n{{reference}}{{amountKes}}\nReview and approve/reject it from the school\'s Billing tab in the Super Admin dashboard.',
    smsBody: 'School ERP: "{{schoolName}}" submitted a {{methodLabel}} payment proof — review it in the dashboard.',
  },
  PROOF_RECEIVED_SCHOOL: {
    variables: ['schoolName', 'methodLabel'],
    subject: 'We received your payment confirmation — {{schoolName}}',
    emailBody:
      'Thanks — we\'ve received your {{methodLabel}} payment confirmation for "{{schoolName}}" and are verifying it now. Bank and paybill payments can take a little longer to confirm than M-Pesa. You\'ll be notified the moment it\'s confirmed and your school is unlocked. If you don\'t hear back or run into an issue, please contact support.',
    smsBody:
      'School ERP: we received your payment confirmation for "{{schoolName}}" and are verifying it — this can take a little time. You\'ll be notified once confirmed.',
  },
  DEMO_REMINDER: {
    variables: ['schoolName', 'daysLeft', 'expiryDate', 'surveyUrl'],
    subject: 'Your "{{schoolName}}" demo ends soon',
    emailBody:
      'Your School ERP demo for "{{schoolName}}" ends in {{daysLeft}} day(s), on {{expiryDate}}.\n\nEnjoying it so far? We\'d love your feedback — it only takes a minute: {{surveyUrl}}\n\nReady to keep going? Get in touch to move to a full account and keep everything you\'ve set up.',
    smsBody:
      'School ERP: your "{{schoolName}}" demo ends in {{daysLeft}} day(s) ({{expiryDate}}). Quick feedback: {{surveyUrl}}',
  },
  RENEWAL_REMINDER: {
    variables: ['schoolName', 'daysLeft', 'renewalDate'],
    subject: '"{{schoolName}}" renews soon',
    emailBody:
      'Your current billing period for "{{schoolName}}" ends in {{daysLeft}} day(s), on {{renewalDate}}. To avoid any interruption, please get in touch to arrange your next payment.',
    smsBody: 'School ERP: "{{schoolName}}" renews in {{daysLeft}} day(s) ({{renewalDate}}). Contact us to renew.',
  },
  SETTINGS_OTP: {
    variables: ['code'],
    subject: 'Confirm platform settings change',
    emailBody:
      'A change to your platform settings was requested. If this was you, enter code {{code}} to confirm. It expires in 15 minutes. If you didn\'t request this, ignore this message — nothing changes until the code is confirmed.',
    smsBody: 'School ERP: confirm your settings change with code {{code}}. Expires in 15 min.',
  },
};
