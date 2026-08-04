-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "PlatformMailbox" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT,
    "password" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEmailThread" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "participantEmail" TEXT NOT NULL,
    "participantName" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEmailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMailbox_key_key" ON "PlatformMailbox"("key");

-- CreateIndex
CREATE INDEX "PlatformEmailThread_mailboxId_lastMessageAt_idx" ON "PlatformEmailThread"("mailboxId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEmailMessage_messageId_key" ON "PlatformEmailMessage"("messageId");

-- CreateIndex
CREATE INDEX "PlatformEmailMessage_threadId_createdAt_idx" ON "PlatformEmailMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformEmailThread" ADD CONSTRAINT "PlatformEmailThread_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "PlatformMailbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformEmailMessage" ADD CONSTRAINT "PlatformEmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "PlatformEmailThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformEmailMessage" ADD CONSTRAINT "PlatformEmailMessage_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

