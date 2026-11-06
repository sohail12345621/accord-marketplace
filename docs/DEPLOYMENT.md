# Accord Deployment Guide (100% Free Tier Architecture)

Accord is engineered to run on free developer tiers without requiring paid infrastructure.

---

## 1. Architecture Map

```text
[ Vercel / Netlify Free ] (React Frontend SPA)
            ↓ HTTPS
[ Render / Railway / Fly.io Free ] (FastAPI Python Backend)
            ↓ TCP
[ Neon / Supabase Free PostgreSQL ] (Relational Database)
            ↓ REST & WebSockets
[ Nexconn Free Developer Plan ] (Real-Time Messaging Infrastructure)
```

---

## 2. Nexconn Messaging (Free Tier)
1. Register a free account at [Nexconn Console](https://console.nexconn.ai).
2. The console automatically allocates an App on the **Free** plan (no credit card needed).
3. Under **Key Management**, copy:
   - `App Key`
   - `App Secret`
   - Data center region (Default: `SG` / Singapore)
4. Add these into your backend environment variables (`NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`).

---

## 3. Database (Neon or Supabase Free PostgreSQL)
1. Create a free project at [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the PostgreSQL connection string.
3. Set `DATABASE_URL` in backend environment:
   ```text
   DATABASE_URL=postgresql+psycopg://username:password@ep-host.region.neon.tech/accord_db?sslmode=require
   ```

---

## 4. Backend (Render / Railway / Fly.io)
1. Connect your GitHub repository to Render as a **Web Service**.
2. Settings:
   - **Environment**: Python
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables:
   - `ENVIRONMENT=production`
   - `DATABASE_URL=<your-neon-url>`
   - `JWT_SECRET=<generate-a-strong-32char-secret>`
   - `CORS_ORIGINS=https://your-frontend.vercel.app`
   - `NEXCONN_APP_KEY=<your-key>`
   - `NEXCONN_APP_SECRET=<your-secret>`

---

## 5. Frontend (Vercel)
1. Connect your repository to [Vercel](https://vercel.com).
2. Set Root Directory: `frontend`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Configure `vite.config.ts` or set proxy rewrite in `vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://your-backend.onrender.com/api/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
