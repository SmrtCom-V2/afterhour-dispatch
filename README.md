# FM After-Hours Dispatch System - MVP

AI-powered after-hours dispatch system for facilities management.

## What It Does

1. **Phone Intake** - AI answers calls in DE/EN, verifies tenants, asks guided questions
2. **Emergency Classification** - Hard rules + AI confidence scoring
3. **SP Dispatch** - Auto-call SPs with accept/decline, SMS fallback, SLA timers
4. **SP Reports** - One-time secure links, required photos, "NO REPORT = NO PAYMENT"
5. **Morning Reports** - Auto-generated PDFs sent to PMs at 7 AM

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE fm_afterhours;"
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database URL and other settings
# DATABASE_URL=postgresql://user:password@localhost:5432/fm_afterhours

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 4. Login

- URL: http://localhost:5173
- Email: admin@demo.com
- Password: demo123

> Note: Super Admin auth is separate from tenant/admin auth. Super Admins use `/sa/auth/login`, store their token under `sa_token`, and receive tokens scoped with `role=super_admin` so they can be signed in simultaneously without interfering with regular tenant sessions.

## Project Structure

```
web-system/
├── backend/
│   ├── src/
│   │   ├── config/          # App configuration
│   │   ├── db/              # Database schema and connection
│   │   ├── middleware/      # Auth, error handling
│   │   ├── providers/       # Telephony, Voice AI, Storage, Email (provider-agnostic)
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (dispatch, call flow, reports)
│   │   ├── jobs/            # Scheduled tasks
│   │   └── utils/           # Logger, helpers
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/      # Shared components
    │   ├── context/         # Auth context
    │   ├── pages/           # Dashboard, Incidents, Buildings, etc.
    │   └── utils/           # API client
    └── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Buildings
- `GET /api/buildings` - List buildings
- `POST /api/buildings` - Create building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Delete building

### Tenants
- `GET /api/tenants` - List tenants
- `POST /api/tenants` - Create tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Deactivate tenant

### Service Providers
- `GET /api/service-providers` - List SPs
- `POST /api/service-providers` - Create SP
- `PUT /api/service-providers/:id` - Update SP
- `DELETE /api/service-providers/:id` - Delete SP

### Incidents
- `GET /api/incidents` - List incidents
- `GET /api/incidents/stats` - Dashboard stats
- `GET /api/incidents/:id` - Incident detail
- `PUT /api/incidents/:id/close` - Close incident

### Reports
- `GET /api/reports` - List morning reports
- `POST /api/reports/:id/resend` - Resend report
- `GET /api/reports/:id/pdf` - Download PDF

### Webhooks (Telephony)
- `POST /api/webhooks/incoming-call` - Inbound call handler
- `POST /api/webhooks/sp-call/:attemptId` - SP call handler
- `POST /api/webhooks/sms-response` - SMS response handler

### SP Report (Public, no auth)
- `GET /api/sp-report/:token` - Get report form
- `POST /api/sp-report/:token` - Submit report

## Configuration

### Telephony Provider
Default: Mock (for development). Configure Twilio in `.env`:

```
TELEPHONY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Voice AI Provider
Default: Mock (for development). Configure OpenAI in `.env`:

```
VOICE_AI_PROVIDER=openai
OPENAI_API_KEY=xxx
```

## Emergency Rules (Hard-coded MVP)

**Always Emergency:**
- Water leak
- Fire
- Smoke
- Gas smell
- Total power outage

**Not Emergency:**
- Lockout (unless FM overrides)

**AI Confidence:**
- Default threshold: 80%
- Per-building override supported
- Below threshold → Escalate to FM on-call

## SP Dispatch Flow

1. Get SPs by trade + priority for building
2. Call SP #1, wait 2 minutes
3. If no pickup → Send SMS, wait 10 minutes
4. If no response → Next SP
5. If all SPs unavailable → SMS to FM on-call
6. If SP accepts → Send report link (deadline: 9 AM)

## What's NOT in MVP

- PM login/dashboard
- SP accounts/apps
- Live call bridging
- Billing engine
- Analytics
- Role permissions beyond FM admin
- Mobile app

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure real Twilio/OpenAI credentials
3. Set up PostgreSQL
4. Configure SMTP for email
5. Set up S3 for photo storage (optional)
6. Deploy behind reverse proxy (nginx)
