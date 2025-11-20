# Clear Browser Cache to See New UI

## Problem
Vercel deployment is live with new code, but browser shows old cached version.

## Solutions (Try in Order)

### Solution 1: Hard Refresh (Fastest)

**Windows/Linux:**
- Press `Ctrl + Shift + R`
- Or `Ctrl + F5`

**Mac:**
- Press `Cmd + Shift + R`

### Solution 2: Empty Cache and Hard Reload

1. Open Developer Tools: Press `F12`
2. Right-click the refresh button (next to address bar)
3. Select "Empty Cache and Hard Reload"

### Solution 3: Clear Browser Cache

1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"
5. Refresh the page

### Solution 4: Incognito/Private Window

1. Press `Ctrl + Shift + N` (Chrome) or `Ctrl + Shift + P` (Firefox)
2. Open your Vercel URL in the new window
3. This bypasses all cache

### Solution 5: Disable Cache in DevTools

1. Open Developer Tools: `F12`
2. Go to Network tab
3. Check "Disable cache" checkbox
4. Keep DevTools open
5. Refresh the page

### Solution 6: Clear Vercel Build Cache

If browser cache clearing doesn't work:

1. Go to Vercel Dashboard
2. Project Settings → General
3. Scroll to "Clear Build Cache"
4. Click "Clear Build Cache"
5. Redeploy the project

## What You Should See After Clearing Cache

**New Table Columns:**
- Relationship
- Distributor
- Reseller
- End User
- Email (To)
- Edition
- Licensing
- Expires
- Status
- Actions

**NOT the old columns:**
- ❌ COMPANY
- ❌ CONTACT
- ❌ EMAIL
- ❌ PLAN

## Quick Test

After clearing cache, you should see:
- "Sync from Supabase" button (green, with database icon)
- "Send Test Email" button (blue mail icon in Actions column)
- New relationship-based columns




