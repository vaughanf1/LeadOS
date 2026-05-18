-- CreateEnum
CREATE TYPE "AdvisorGroup" AS ENUM ('A', 'B', 'BACKEND');

-- CreateEnum
CREATE TYPE "AdvisorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'HOLIDAY', 'FULL');

-- CreateEnum
CREATE TYPE "DeliveryPref" AS ENUM ('SMS', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "QualityBand" AS ENUM ('HIGH', 'MID', 'LOW');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'HELD', 'SENT', 'FAILED', 'DUPLICATE', 'AFTER_HOURS');

-- CreateEnum
CREATE TYPE "AfterHoursMode" AS ENUM ('CRAIG', 'HOLD', 'AI_CHATBOT');

-- CreateEnum
CREATE TYPE "NotifyChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotifyStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Advisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "group" "AdvisorGroup" NOT NULL DEFAULT 'A',
    "status" "AdvisorStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferredDelivery" "DeliveryPref" NOT NULL DEFAULT 'BOTH',
    "dailyLeadCap" INTEGER NOT NULL DEFAULT 2,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "acceptsHigh" BOOLEAN NOT NULL DEFAULT true,
    "acceptsMid" BOOLEAN NOT NULL DEFAULT true,
    "acceptsLow" BOOLEAN NOT NULL DEFAULT false,
    "weekendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pausedUntil" TIMESTAMP(3),
    "notes" TEXT,
    "leadsReceivedToday" INTEGER NOT NULL DEFAULT 0,
    "countersResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorSchedule" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AdvisorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "facebookLeadgenId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "postcode" TEXT,
    "age" INTEGER,
    "propertyValue" INTEGER,
    "mortgageRemaining" INTEGER,
    "urgency" TEXT,
    "enquiryStage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'facebook',
    "rawPayload" JSONB,
    "qualityScore" INTEGER,
    "qualityBand" "QualityBand",
    "assignedGroup" "AdvisorGroup",
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "advisorId" TEXT,
    "channel" "NotifyChannel" NOT NULL,
    "status" "NotifyStatus" NOT NULL DEFAULT 'PENDING',
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "subject" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminCommand" (
    "id" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedAction" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Advisor_status_idx" ON "Advisor"("status");

-- CreateIndex
CREATE INDEX "Advisor_group_idx" ON "Advisor"("group");

-- CreateIndex
CREATE INDEX "AdvisorSchedule_advisorId_idx" ON "AdvisorSchedule"("advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSchedule_advisorId_dayOfWeek_key" ON "AdvisorSchedule"("advisorId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_facebookLeadgenId_key" ON "Lead"("facebookLeadgenId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_qualityBand_idx" ON "Lead"("qualityBand");

-- CreateIndex
CREATE INDEX "Lead_receivedAt_idx" ON "Lead"("receivedAt");

-- CreateIndex
CREATE INDEX "LeadAssignment_advisorId_createdAt_idx" ON "LeadAssignment"("advisorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAssignment_leadId_advisorId_key" ON "LeadAssignment"("leadId", "advisorId");

-- CreateIndex
CREATE INDEX "LeadLog_leadId_createdAt_idx" ON "LeadLog"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadLog_createdAt_idx" ON "LeadLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_leadId_idx" ON "NotificationLog"("leadId");

-- CreateIndex
CREATE INDEX "AdminCommand_createdAt_idx" ON "AdminCommand"("createdAt");

-- AddForeignKey
ALTER TABLE "AdvisorSchedule" ADD CONSTRAINT "AdvisorSchedule_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "Advisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "Advisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadLog" ADD CONSTRAINT "LeadLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "Advisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
