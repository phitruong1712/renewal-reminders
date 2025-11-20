# Force Vercel to Deploy New Version

## Problem
Vercel is showing old UI despite code being correct and pushed to GitHub.

## Solution: Force Fresh Deployment

### Method 1: Create a New Commit to Trigger Deployment

1. Make a small change to trigger deployment:
   ```bash
   cd C:\Users\phi.truong\renewal-reminders
   echo "# Force deploy" >> README.md
   git add README.md
   git commit -m "chore: force Vercel redeploy"
   git push origin main
   ```

### Method 2: Manual Deployment via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your `renewal-reminders` project
3. Click "Deployments" tab
4. Click the blue "Deploy" button (top right)
5. Select:
   - Source: GitHub
   - Branch: `main`
   - Framework Preset: Next.js
   - Root Directory: `./`
6. Click "Deploy"

### Method 3: Check Vercel Project Settings

1. Go to Project Settings → Git
2. Verify:
   - **Production Branch:** Should be `main`
   - **Auto-deploy:** Should be enabled
   - **Repository:** Should be `phitruong1712/renewal-reminders`
3. If anything is wrong, fix it and redeploy

### Method 4: Check Build Logs

1. Go to Deployments tab
2. Click on the latest deployment
3. Check "Build Logs" tab
4. Look for any errors or warnings
5. If build failed, fix errors and redeploy

### Method 5: Disconnect and Reconnect GitHub

1. Project Settings → Git
2. Click "Disconnect" (if connected)
3. Click "Connect Git Repository"
4. Select `phitruong1712/renewal-reminders`
5. Configure settings:
   - Framework: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
6. Click "Deploy"

### Method 6: Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd C:\Users\phi.truong\renewal-reminders
vercel --prod --force
```

## Verify Deployment

After deployment:
1. Wait for build to complete (1-2 minutes)
2. Check deployment status (should be "Ready")
3. Click on the deployment URL
4. Clear browser cache: `Ctrl + Shift + R`
5. Check if new UI appears

## What to Check

1. **Deployment URL:** Make sure you're checking the correct deployment
2. **Build Status:** Should be "Ready" (green checkmark)
3. **Commit Hash:** Should match your latest commit
4. **Build Logs:** Check for any errors

## If Still Not Working

1. Check if Vercel is deploying from the correct branch
2. Verify the commit hash in Vercel matches GitHub
3. Check if there are multiple deployments (preview vs production)
4. Try accessing a preview deployment URL instead




