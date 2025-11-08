# Kartess - Unified Social Media Platform

A comprehensive social media application built with Next.js, Express.js, PostgreSQL, and modern technologies. Kartess integrates multiple modules (Connect, Visuals, Threads, CareerNet) with real-time messaging, live streaming, and enterprise-ready features.

## 🚀 Features

### Phase 1: Core Setup & Authentication
- ✅ Landing page with modern UI
- ✅ User registration with Zod validation
- ✅ JWT-based authentication with refresh tokens
- ✅ Automatic token refresh on expiry
- ✅ Profile completion with avatar upload (Cloudinary)
- ✅ Protected routes with auth guards
- ✅ Sentry error monitoring

### Phase 2: Unified Timeline & Social Features
- ✅ Unified timeline feed aggregating all modules
- ✅ Cross-module posting with media support
- ✅ Global search with autocomplete
- ✅ Follow/Connect mechanism with notifications
- ✅ User profile viewing
- ✅ Real-time updates via Socket.io

### Phase 3: Smart Contacts & QR Codes
- ✅ Contacts hub with shared data
- ✅ Smart business cards with visibility presets
- ✅ QR code generation and scanning
- ✅ Contact approval workflow
- ✅ Visibility preset management

### Phase 4: Messaging & Notifications
- ✅ Real-time chat threads (1:1 and groups)
- ✅ Encrypted messaging with client-side encryption
- ✅ Media support in messages
- ✅ Read receipts and typing indicators
- ✅ Comprehensive notification system
- ✅ Real-time notification updates

### Phase 5: Connect & Visuals Modules
- ✅ Connect module feed for social networking
- ✅ Visuals module with masonry grid layout
- ✅ Stories (ephemeral content, 24h expiry)
- ✅ Advanced post interactions (multi-reaction, nested comments)
- ✅ Explore page for curated visual content
- ✅ Real-time reactions and comments

### Phase 6: Threads & CareerNet
- ✅ Discussion threads with topic categorization
- ✅ Nested replies (up to 3 levels)
- ✅ Thread pinning and locking
- ✅ Job postings with full details
- ✅ Job applications with resume upload
- ✅ Skill endorsements system
- ✅ Live streaming infrastructure (Agora)
- ✅ Background job endpoints for Trigger.dev

### Phase 7: Admin, Analytics & Production
- ✅ Admin dashboard with platform statistics
- ✅ User management (suspend, verify, role management)
- ✅ Content moderation system
- ✅ Report system for users
- ✅ User analytics and insights
- ✅ Advanced settings (privacy, notifications)
- ✅ Rate limiting for security
- ✅ Activity logging
- ✅ Account deletion feature
- ✅ Structured logging (Winston)
- ✅ Modern UI components (ConfirmModal, Toast)
- ✅ Anti-spam heuristics with abuse detection middleware

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Real-time**: Socket.io Client
- **UI Components**: Custom reusable components
- **Image Optimization**: Next.js Image with Cloudinary
- **Deployment**: Vercel

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Authentication**: JWT, bcrypt
- **Real-time**: Socket.io
- **File Storage**: Cloudinary
- **Validation**: Zod
- **Monitoring**: Sentry
- **Live Streaming**: Agora SDK
- **Deployment**: Railway

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- Cloudinary account
- Agora account (for live streaming)
- Sentry account (optional, for error monitoring)

### Backend Setup

1. **Copy environment variables template:**
```bash
cd backend
cp .env.example .env
```

2. **Edit `.env` file with your actual credentials:**
   - Get `DATABASE_URL` from your Neon PostgreSQL database
   - Generate a secure `JWT_SECRET` (use a random string generator)
   - Get `CLOUDINARY_URL` from your Cloudinary dashboard
   - Set `FRONTEND_URL` to your Vercel deployment URL (or `http://localhost:3000` for local dev)
   - Optionally add Sentry DSN, Agora credentials, VAPID keys for push notifications

3. **Install dependencies and run migrations:**
```bash
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Add your DATABASE_URL, JWT_SECRET, CLOUDINARY_URL, etc.

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install

# Set up environment variables
cp .env.example .env.local
# Add your NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, etc.

# Start development server
npm run dev
```

## 🔐 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
CLOUDINARY_URL=cloudinary://...
SENTRY_DSN=your-sentry-dsn
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
TRIGGER_API_KEY=your-trigger-api-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:your-email@example.com
CAPTCHA_PROVIDER=recaptcha_v3 # Optional: enable CAPTCHA enforcement
RECAPTCHA_SECRET=your-recaptcha-secret
RECAPTCHA_MIN_SCORE=0.5
PORT=3001
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_ENCRYPTION_KEY=your-encryption-key
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
```

## 🗄️ Database Schema

The Prisma schema includes models for:
- Users, Profiles (with JSONB for handles and presets)
- Posts, Comments, Reactions
- Contacts, Notifications
- ChatThreads, Messages, MessageReads
- Threads, ThreadReplies
- Jobs, Applications, Endorsements
- CallSessions (live streaming)
- Reports, ActivityLogs

## 🚀 Deployment

### Backend (Railway)
1. Connect GitHub repository
2. Select the `backend` directory as project root
3. Add all environment variables in Railway dashboard
4. Railway will automatically deploy on push to main branch

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set root directory to `frontend`
3. Add all environment variables in Vercel dashboard
4. Vercel will automatically deploy on push to main branch

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (returns access token and refresh token)
- `POST /api/auth/login` - Login user (returns access token and refresh token)
- `POST /api/auth/refresh` - Refresh access token using refresh token
- `POST /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users/:username` - Get user by username
- `GET /api/users/:username/analytics` - Get user analytics
- `PATCH /api/users/settings` - Update user settings
- `DELETE /api/users/account` - Delete user's own account

## 🔍 Monitoring & Observability

### Health Checks
- `GET /health` returns service status including:
  - API version, environment, optional `GIT_SHA`
  - Process uptime (`uptimeSeconds`, `uptimeHuman`)
  - Database connectivity with latency metrics
  - Basic process memory usage and response time
- Configure an uptime monitor (e.g. UptimeRobot, BetterStack, Vercel checks) to poll `/health` and alert on non-200 responses.

### Logging
- Winston writes structured JSON logs to stdout (development) and to `backend/logs/combined.log` / `backend/logs/error.log` in production.
- Tail logs locally with `tail -f backend/logs/combined.log` (macOS/Linux) or `Get-Content -Path backend/logs/combined.log -Wait` (PowerShell).
- Include the `requestId` returned by API responses when correlating requests in the logs.

## 🛡️ Abuse Prevention
- Abuse detection middleware adds request-scoped context (`req.abuseContext`) and blocks rapid duplicate submissions.
- Basic spam keyword filtering is applied to post and message submissions; extend keywords in `backend/middleware/abuseDetection.js`.
- CAPTCHA support can be layered later by toggling the scaffolded verification hook (see documentation below).
- To enforce Google reCAPTCHA v3/v2, set `CAPTCHA_PROVIDER` (`recaptcha_v3` or `recaptcha_v2`) and `RECAPTCHA_SECRET`. Optional `RECAPTCHA_MIN_SCORE` defaults to `0.5`.

## ♿ Accessibility
- `eslint-plugin-jsx-a11y` is baked into the frontend lint configuration. Run `npm run lint` in `frontend/` to surface accessibility issues during CI/local builds.
- Core interactive components (`Button`, `ConfirmModal`, `Toast`) now expose semantic roles, aria attributes, and sensible defaults (e.g. `type="button"`).
- Manual testing checklist:
  - Keyboard navigate critical flows (registration, posting, messaging) to ensure focus visibility.
  - Run Lighthouse Accessibility audits in Chrome DevTools for high-traffic pages.
  - Use screen reader shortcuts (VoiceOver, NVDA) to confirm modal/dialog announcements.

### Posts
- `GET /api/posts/timeline` - Get unified timeline
- `POST /api/posts` - Create post
- `GET /api/posts/module/:module` - Get module-specific posts
- `GET /api/posts/user/:userId` - Get user posts

### Search
- `GET /api/search` - Global search
- `GET /api/search/autocomplete` - Autocomplete suggestions

### Contacts
- `POST /api/contacts/follow` - Send follow request
- `POST /api/contacts/approve/:contactId` - Approve contact

### Messaging
- `GET /api/chats` - Get chat threads
- `POST /api/chats` - Create chat thread
- `GET /api/chats/:threadId/messages` - Get messages
- `POST /api/messages` - Send message

### Admin (Admin/Moderator only)
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - User management
- `PATCH /api/admin/users/:userId` - Update user
- `GET /api/admin/reports` - Get reports
- `PATCH /api/admin/reports/:reportId` - Review report

### Live Streaming
- `POST /api/live/create` - Create live session
- `POST /api/live/join/:sessionId` - Join session
- `GET /api/live/sessions` - Get active sessions

See individual route files for complete API documentation.

## 🎯 Key Features Implementation

### Real-time Updates
- Socket.io integration for live updates
- Real-time post creation
- Live reactions and comments
- Notification broadcasts
- Typing indicators in chats

### Security
- JWT authentication
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Input validation with Zod
- Client-side message encryption
- CORS configuration
- Helmet security headers

### Content Moderation
- User reporting system
- Admin/moderator dashboard
- Content removal capabilities
- User suspension system
- Activity logging

## 📝 Development Notes

- All phases are implemented and tested
- Database migrations should be run before first deployment
- **Important:** Copy `.env.example` to `.env` (backend) and `.env.local` (frontend) and fill in your actual credentials
- Ensure all environment variables are set correctly before running the app
- Prisma schema is synced between frontend and backend
- Mobile-first responsive design throughout

### Required Environment Variables

**Backend (`backend/.env`):**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Secret for JWT token signing (required)
- `FRONTEND_URL` - Your frontend URL for CORS (required)
- `CLOUDINARY_URL` - Cloudinary credentials for media uploads (required)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

**Frontend (`frontend/.env.local`):**
- `NEXT_PUBLIC_API_URL` - Backend API URL (required)

See `.env.example` files in both directories for all optional variables.

## 🔄 Next Steps / Future Enhancements

- Full Agora SDK integration for live streaming UI
- Advanced analytics dashboards
- Email notifications (SMTP configuration required)
- Push notifications (VAPID keys configuration required)
- Advanced search with filters
- Content recommendation algorithm
- Two-factor authentication
- OAuth integration (Google, GitHub, etc.)
- Refresh token rotation for enhanced security

## 📄 License

MIT License

## 👥 Contributing

This is a private project. For questions or contributions, please contact the maintainers.

---

Built with ❤️ using Next.js, Express.js, and PostgreSQL#   K a r t e s s  
 