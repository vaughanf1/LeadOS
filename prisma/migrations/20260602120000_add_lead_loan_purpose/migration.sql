-- Capture what the customer needs the money for (loan purpose) on each lead.
ALTER TABLE "Lead" ADD COLUMN "loanPurpose" TEXT;
