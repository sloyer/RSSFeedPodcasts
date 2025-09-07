// README.md
/*
# RSS Podcast Aggregator

## Setup Instructions

### 1. Supabase Setup (Free Database)
1. Create account at https://supabase.com
2. Create new project
3. Go to SQL Editor and run the SQL from database.sql
4. Get your project URL and anon key from Settings > API

### 2. Vercel Setup (Free Hosting + Cron)
1. Create account at https://vercel.com
2. Install Vercel CLI: `npm i -g vercel`
3. Deploy: `vercel --prod`
4. Add environment variables in Vercel dashboard:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - CRON_SECRET (generate a random string)

### 3. API Endpoints

**Get Podcasts:**
GET /api/podcasts?limit=50&offset=0&search=keyword&podcast_name=The Daily

**Manage Feeds:**
- GET /api/feeds - List all RSS sources
- POST /api/feeds - Add new RSS feed
  Body: { "feed_url": "...", "feed_name": "..." }
- DELETE /api/feeds?id=1 - Remove RSS feed

### 4. Local Development
1. Install dependencies: `npm install`
2. Create .env file with your credentials
3. Run: `npm run dev`
4. Test fetch: `npm run fetch`

### Free Tier Limits
- Supabase: 500MB database, 2GB bandwidth, 50K requests/month
- Vercel: Unlimited deployments, 100GB bandwidth, cron jobs included

### Alternative Free Options
- Database: PostgreSQL on Neon.tech, PlanetScale (MySQL)
- Hosting: Netlify (with scheduled functions), Railway.app
- Cron: GitHub Actions, Render.com cron jobs
*/