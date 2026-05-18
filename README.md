# LeadOS

Equity-release lead distribution system. Receives Facebook Lead Ads webhooks,
scores leads, distributes to advisors based on availability/working-hours/caps,
notifies via SMS + email, and exposes an admin dashboard + AI command chat.

## Stack
- Next.js 15 (App Router, RSC) + TypeScript + Tailwind
- Prisma + Postgres (Supabase / Railway / local)
- Twilio (SMS), Nodemailer/SMTP (email — stubbed to console when SMTP not set)
- OpenAI (natural-language admin commands)
- Vercel Cron (held-lead release + daily counter reset)

## First-time setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL + secrets
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Visit http://localhost:3000 — log in with `ADMIN_PASSWORD`.

## Facebook webhook
- Verify URL: `https://YOUR-DOMAIN/api/webhooks/facebook`
- Verify token: value of `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- Subscribe the page to `leadgen` events.

## Cron
`vercel.json` configures two crons:
- `08:30 UK` → release leads held overnight.
- `00:00 UK` → reset `leadsReceivedToday` on advisors.

If hosting elsewhere, configure equivalent jobs hitting those endpoints with
header `x-cron-secret: $CRON_SECRET`.

## Build phases
1. DB + admin UI ✓
2. Facebook webhook ✓
3. Scoring engine ✓
4. Distribution engine ✓
5. Notifications ✓
6. AI Assistant ✓
7. After-hours handling ✓
