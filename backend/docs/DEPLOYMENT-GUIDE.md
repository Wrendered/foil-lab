# Foil Lab Deployment Guide

This guide covers deploying the Foil Lab platform from the monorepo.

## Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   Next.js Frontend  │         │   FastAPI Backend   │
│   (frontend/)       │ ──────► │   (backend/)        │
│                     │  HTTPS  │                     │
│  Platform: Railway  │         │  Platform: Railway  │
└─────────────────────┘         └─────────────────────┘

Frontend: https://gracious-love-production-ec22.up.railway.app
Backend:  https://foil-lab-production.up.railway.app
```

**Legacy redirect**: https://foil-lab-web.vercel.app (redirects to Railway)

## Backend Deployment (Railway)

### Current Status
**Deployed**: https://foil-lab-production.up.railway.app

### Setup Steps

1. **Create Railway Account**
   - Sign up at https://railway.app
   - Connect GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `foil-lab` repository
   - **Set Root Directory**: `backend`

3. **Configure Service**
   Railway auto-detects Python. Set custom start command:
   ```
   Root Directory: backend
   Start Command: uvicorn api.main:app --host 0.0.0.0 --port $PORT
   ```

4. **Generate Domain**
   - Settings -> Networking -> Generate Domain
   - **Important**: Use the port Railway assigns (typically 8080, check logs)
   - The app uses `$PORT` environment variable

5. **Environment Variables**
   ```bash
   # Optional - for AI gear comparison feature
   ANTHROPIC_API_KEY=your-api-key-here
   ```

6. **Verify Deployment**
   ```bash
   curl https://foil-lab-production.up.railway.app/api/health
   # Should return: {"status":"healthy","service":"foil-lab-api"}
   ```

## Frontend Deployment (Railway)

### Current Status
**Deployed**: https://gracious-love-production-ec22.up.railway.app

### Setup Steps

1. **Add New Service to Project**
   - In same Railway project, click "+ New"
   - Select "GitHub Repo"
   - Choose `foil-lab` repository
   - **Set Root Directory**: `frontend`

2. **Environment Variables**
   ```bash
   NEXT_PUBLIC_API_URL=https://foil-lab-production.up.railway.app
   NEXT_PUBLIC_APP_ENV=production
   NEXT_PUBLIC_ENABLE_WIND_LINES=true
   NEXT_PUBLIC_ENABLE_VMG_HIGHLIGHT=true
   ```

3. **Generate Domain**
   - Settings -> Networking -> Generate Domain
   - Use port **3000** for Next.js

4. **Verify Deployment**
   - Visit the generated URL
   - Check that it connects to backend (no "Connection Lost" error)

## Local Development

```bash
# Clone the monorepo
git clone https://github.com/Wrendered/foil-lab.git
cd foil-lab

# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run_api.py
# API at http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm install
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
# App at http://localhost:3000
```

## Port Configuration

### Railway Port Behavior
- Railway sets `$PORT` environment variable (typically 8080)
- Always use `--port $PORT` in start commands
- When generating domains, check logs for actual port

### Local Development Ports
- Backend: 8000 (hardcoded in run_api.py)
- Frontend: 3000 (Next.js default)

## CORS Configuration

The backend allows requests from these origins (in `backend/api/main.py`):
- `http://localhost:3000` (local dev)
- `https://foil-lab-web.vercel.app` (legacy Vercel)
- `https://gracious-love-production-ec22.up.railway.app` (Railway frontend)

To add new origins, edit `backend/api/main.py` and redeploy.

## Monitoring

### Railway Dashboard
- Logs: Click service -> Deployments -> View Logs
- Metrics: Click service -> Metrics tab

### Health Checks
```bash
# Backend
curl https://foil-lab-production.up.railway.app/api/health

# Frontend (should return HTML)
curl -I https://gracious-love-production-ec22.up.railway.app/
```

## Troubleshooting

### 502 Application Failed to Respond
- Check deployment logs for errors
- Verify port matches between app and domain configuration
- Check that `$PORT` is used in start command

### CORS Errors
- Add frontend URL to `allow_origins` in `backend/api/main.py`
- Redeploy backend

### Connection Lost in Frontend
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is healthy: `curl .../api/health`
- Rebuild frontend after changing env vars

## Cost Estimates

### Railway (Both Services)
- Free tier: Limited hours/month
- Pro: ~$5-20/month per service
- **Total: $10-40/month**

### Legacy Vercel (Redirect Only)
- Free tier: Sufficient for redirect
- **Total: $0/month**
