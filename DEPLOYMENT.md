# Deployment Guide

This guide covers deploying the CompanyUser application to production.

## Architecture Overview

- **Frontend**: Next.js 14 application (deployed to Vercel)
- **Backend**: Go/Fiber API server (needs separate hosting)
- **Database**: Supabase PostgreSQL

## Frontend Deployment (Vercel)

### Prerequisites
- GitHub/GitLab/Bitbucket account
- Vercel account (free tier works)
- Backend API deployed and accessible

### Step 1: Prepare Repository
1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Ensure `vercel.json` is in the frontend directory

### Step 2: Deploy to Vercel

#### Option A: Using Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your Git repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://byhnyrhltrqjzqhsajli.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=https://your-backend-api-url.com
   ```

6. Click **"Deploy"**

#### Option B: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

### Step 3: Configure Environment Variables
After deployment, go to your project settings in Vercel:
1. Navigate to **Settings** → **Environment Variables**
2. Add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `NEXT_PUBLIC_API_URL`: Your deployed backend API URL (e.g., `https://api.yourdomain.com`)

3. Redeploy to apply changes

## Backend Deployment

The Go backend needs to be deployed separately. Here are recommended options:

### Option 1: Railway (Recommended for Go)
1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Select the `backend` directory
4. Add environment variables from `.env`:
   ```
   PORT=8080
   JWT_SECRET=your_jwt_secret
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_postgres_connection_string
   ```
5. Railway will auto-detect Go and deploy

### Option 2: Render
1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `go build -o main .`
   - **Start Command**: `./main`
5. Add environment variables
6. Deploy

### Option 3: Fly.io
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Navigate to backend directory: `cd backend`
3. Create `Dockerfile`:
   ```dockerfile
   FROM golang:1.21-alpine AS builder
   WORKDIR /app
   COPY go.mod go.sum ./
   RUN go mod download
   COPY . .
   RUN go build -o main .

   FROM alpine:latest
   RUN apk --no-cache add ca-certificates
   WORKDIR /root/
   COPY --from=builder /app/main .
   EXPOSE 8080
   CMD ["./main"]
   ```
4. Run: `fly launch`
5. Set secrets: `fly secrets set JWT_SECRET=xxx SUPABASE_URL=xxx ...`
6. Deploy: `fly deploy`

### Option 4: DigitalOcean App Platform
1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Create new app from GitHub
3. Select `backend` directory
4. DigitalOcean will detect Go automatically
5. Add environment variables
6. Deploy

## Post-Deployment Steps

### 1. Update CORS Settings
Update the backend CORS configuration in `main.go` to allow your Vercel domain:
```go
app.Use(cors.New(cors.Config{
    AllowOrigins: "https://your-vercel-app.vercel.app",
    AllowHeaders: "Origin, Content-Type, Accept, Authorization",
    AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
}))
```

### 2. Update Frontend API URL
Ensure `NEXT_PUBLIC_API_URL` in Vercel points to your deployed backend URL.

### 3. Test Authentication
1. Visit your deployed frontend URL
2. Try logging in with test credentials
3. Verify API calls are working

### 4. Setup Custom Domain (Optional)
#### For Frontend (Vercel):
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

#### For Backend:
Configure custom domain through your hosting provider (Railway/Render/Fly.io)

## Environment Variables Reference

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Backend (.env)
```bash
PORT=8080
JWT_SECRET=your_secure_jwt_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## Troubleshooting

### Frontend Issues
- **Build fails**: Check Node.js version (should be 18+)
- **API calls fail**: Verify `NEXT_PUBLIC_API_URL` is correct and backend is running
- **Authentication issues**: Check Supabase credentials

### Backend Issues
- **Port binding errors**: Ensure PORT environment variable is set
- **Database connection fails**: Verify DATABASE_URL is correct
- **CORS errors**: Update AllowOrigins to include your frontend URL

## Monitoring

### Vercel
- View deployment logs in Vercel dashboard
- Monitor performance in Analytics tab

### Backend
- Use your hosting provider's logging dashboard
- Consider adding application monitoring (e.g., Sentry, DataDog)

## Security Checklist

- [ ] Change default JWT_SECRET to a strong random value
- [ ] Use HTTPS for all endpoints
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Restrict CORS to specific domains (not `*`)
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting on backend
- [ ] Review and restrict Supabase API keys permissions

## Continuous Deployment

Both Vercel and most backend platforms support automatic deployments:
1. Push to your main/master branch
2. Platform automatically detects changes
3. Builds and deploys new version
4. Zero-downtime deployment

## Cost Estimates

- **Vercel**: Free tier (100GB bandwidth, unlimited deployments)
- **Railway**: ~$5/month (500 hours, 8GB RAM)
- **Render**: Free tier available, paid starts at $7/month
- **Supabase**: Free tier (500MB database, 2GB bandwidth)

## Support

For deployment issues:
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Railway: [docs.railway.app](https://docs.railway.app)
- Render: [render.com/docs](https://render.com/docs)
- Supabase: [supabase.com/docs](https://supabase.com/docs)
