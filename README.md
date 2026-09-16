# Aditya Group CRM Portal — Next.js Edition

A full-stack CRM portal built with **Next.js 16 + Tailwind CSS + Prisma + Supabase**, deployable on Vercel free tier.

## Architecture
- **Frontend**: Next.js App Router + React Server Components + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (app/api/*) — no separate Express server
- **Database**: Supabase Postgres (free tier)
- **Realtime**: Supabase Realtime (subscribes to `crm_leads` table changes) + 30s polling fallback
- **Auth**: OTP-based login (Gmail SMTP), JWT in httpOnly cookies
- **ORM**: Prisma 6

## Features
- OTP-only login (no passwords) — 6-digit code emailed via Gmail SMTP
- Role hierarchy: Super Admin → Admin → Operator → Department User
- Lead lifecycle: create → assign → follow-up → convert/close/lost → recycle → permanent delete
- Cascade validation: Dealer → Brand → Model → Enquiry Type → Department → Assigned User
- Per-department update forms (Sales, Service, Finance, Insurance, etc.)
- Recycle Bin (super_admin + admin only) with Leads/Users/Models tabs
- Performance Report with role scoping (admin can't see super_admins)
- Reports with CSV/PDF/Excel export
- Real-time notifications via Supabase Realtime
- Light/dark theme
- Responsive (mobile sidebar drawer)

## Vercel Deployment

1. **Push to GitHub** and import the repo in Vercel.

2. **Set environment variables** in Vercel (Project Settings → Environment Variables):
   ```
   DATABASE_URL=<set-in-deployment-secret-manager>
   JWT_SECRET=<set-in-deployment-secret-manager>
   JWT_EXPIRES_IN=8h
   LOGIN_OTP_TTL_MINUTES=2
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=<set-in-deployment-secret-manager>
   SMTP_PASS=<set-in-deployment-secret-manager>
   SMTP_FROM=<set-in-deployment-secret-manager>
   NEXT_PUBLIC_SUPABASE_URL=https://jwlwjecwsefsprcceeuh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<set-in-deployment-secret-manager>
   ```

3. **Deploy** — Vercel auto-detects Next.js and runs `next build`.

4. **Enable Supabase Realtime** (for live notifications):
   - Go to Supabase Dashboard → Database → Replication
   - Enable Realtime for the `crm_leads` table
   - Get the anon key from Supabase Dashboard → Settings → API

## Local Development

```bash
bun install
bun run db:generate    # Generate Prisma client
bun run db:push       # Push schema to Supabase (idempotent)
bun run dev           # Start dev server on http://localhost:3000
```

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York style)
- Prisma 6 + PostgreSQL
- Supabase (Postgres + Realtime)
- @supabase/supabase-js
- nodemailer (Gmail SMTP)
- jsonwebtoken (JWT auth)
- bcryptjs (random password hash, not used for login)
- exceljs + pdfkit (report exports)
- lucide-react (icons)
- next-themes (dark mode)
- sonner (toasts)
