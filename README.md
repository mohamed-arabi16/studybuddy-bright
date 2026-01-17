# StudyBuddy - AI-Powered Study Planning Platform

An intelligent study planning application that helps students organize their coursework, extract topics from syllabi using AI, and generate personalized study plans.

## Features

- 📚 **Course Management**: Create and organize courses with exam dates
- 🤖 **AI Topic Extraction**: Upload syllabi (PDF) and let AI extract study topics
- 📅 **Smart Study Plans**: Generate personalized study schedules
- 🧠 **Quiz Generation**: Generate AI quizzes from course material
- 🧮 **Grade Calculator**: Calculate grades with "what-if" analysis
- 💳 **Credits System**: Usage tracking and cost analysis
- 🍅 **Pomodoro Timer**: Built-in focus sessions
- 📊 **Progress Tracking**: Track completed topics and study time
- 📆 **Calendar Sync**: Optional Google Calendar integration
- 🌐 **Multilingual**: English and Arabic support

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **AI**: Google Gemini via Lovable AI Gateway
- **Payments**: Stripe
- **Error Tracking**: Sentry

## Getting Started

### Prerequisites

- Node.js 20+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or bun
- Supabase CLI (for local development and migrations)

### Local Development

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd studybuddy-bright

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Configuration

Copy `.env.example` to `.env.local` and configure:

```env
# Required: Supabase configuration
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"

# Optional: Sentry error tracking
VITE_SENTRY_DSN="your-sentry-dsn"
```

See `.env.example` for all available configuration options.

### Edge Function Secrets

Configure these secrets in Supabase Dashboard or via CLI:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set LOVABLE_API_KEY=your-api-key
supabase secrets set GOOGLE_CLIENT_ID=your-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
supabase secrets set TOKEN_ENCRYPTION_KEY=your-32-byte-hex-key
```

## Deployment

### Environments

| Environment | Branch | Description |
|-------------|--------|-------------|
| Development | `*` | Local development |
| Staging | `main` | Pre-production testing, Stripe Test Mode |
| Production | `v*.*.*` tags | Live environment, Stripe Live Mode |

### CI/CD Pipeline

The project uses GitHub Actions for continuous deployment:

1. **Pull Requests**: Run linting and build checks
2. **Push to main**: Auto-deploy to Staging
3. **Tagged releases**: Auto-deploy to Production

### Manual Deployment

```bash
# Deploy to staging
npm run build
supabase db push --project-ref $STAGING_PROJECT_REF
supabase functions deploy --project-ref $STAGING_PROJECT_REF

# Deploy to production (use tagged release)
git tag v1.0.0
git push origin v1.0.0
```

## Documentation

- [Production Readiness Spec](./PRODUCTION_READINESS.md) - Production requirements and checklist
- [Operations Runbooks](./docs/RUNBOOKS.md) - Incident response procedures
- [Super Admin Guide](./SUPER_ADMIN.md) - Admin panel documentation

## Project Structure

```
studybuddy-bright/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts (Language, Auth)
│   ├── hooks/          # Custom React hooks
│   ├── integrations/   # Supabase client and types
│   ├── pages/          # Route pages
│   └── lib/            # Utility functions
├── supabase/
│   ├── functions/      # Edge Functions
│   └── migrations/     # Database migrations
├── docs/               # Documentation
└── public/             # Static assets
```

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm run build`
4. Submit a pull request

## License

Proprietary - All rights reserved
