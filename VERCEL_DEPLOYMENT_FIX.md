# Fix Vercel Deployment Issue

## Problem
Recent commits aren't triggering Vercel deployments.

## Solutions

### Solution 1: Manually Trigger Deployment in Vercel

1. Go to https://vercel.com/dashboard
2. Select your `renewal-reminders` project
3. Click on "Deployments" tab
4. Click the "..." menu on the latest deployment
5. Select "Redeploy"
6. Or click "Deploy" button and select "Deploy from GitHub"

### Solution 2: Check Vercel Project Settings

1. Go to Project Settings → Git
2. Verify:
   - ✅ GitHub repository is connected
   - ✅ Production branch is set to `main`
   - ✅ Auto-deploy is enabled
3. If auto-deploy is disabled, enable it

### Solution 3: Check GitHub Webhook

1. Go to your GitHub repo: https://github.com/phitruong1712/renewal-reminders
2. Go to Settings → Webhooks
3. Look for Vercel webhook
4. Check if it's active and receiving events
5. If missing, reconnect Vercel to GitHub

### Solution 4: Reconnect Vercel to GitHub

1. In Vercel dashboard → Project Settings → Git
2. Click "Disconnect" (if connected)
3. Click "Connect Git Repository"
4. Select your GitHub repo
5. Configure:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: npm run build
   - Output Directory: .next
6. Save and deploy

### Solution 5: Check Build Logs

1. Go to Vercel dashboard → Deployments
2. Click on any failed deployment (red dot)
3. Check the build logs for errors
4. Fix any build errors

### Solution 6: Use Vercel CLI (Alternative)

If web UI doesn't work, use CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd C:\Users\phi.truong\renewal-reminders
vercel --prod
```

## Quick Fix: Manual Redeploy

**Fastest solution:**
1. Go to Vercel dashboard
2. Find your project
3. Click "Deployments"
4. Find the latest successful deployment
5. Click "..." → "Redeploy"
6. This will redeploy the latest code

## Check Deployment Status

After triggering deployment:
- Wait 1-2 minutes
- Check the deployment status (should show "Building" then "Ready")
- Once "Ready", your changes will be live




