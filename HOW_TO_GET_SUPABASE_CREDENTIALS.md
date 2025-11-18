# How to Get Supabase Credentials

## Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Sign in to your account
3. Select your project (or create one if you don't have one)

## Step 2: Get Your Project URL

1. In your project dashboard, go to **Settings** (gear icon in left sidebar)
2. Click on **API** in the settings menu
3. Under **Project URL**, you'll see your URL (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
4. Copy this URL

## Step 3: Get Your Service Role Key

1. Still in **Settings → API**
2. Scroll down to **Project API keys**
3. Find the **`service_role`** key (⚠️ **IMPORTANT**: Use `service_role`, NOT `anon` key)
4. Click the **eye icon** to reveal it, then copy it
5. This key starts with `eyJ...` and is very long

## Step 4: Add to .env.local

Open the file: `C:\Users\phi.truong\renewal-reminders\.env.local`

Add these two lines (replace with your actual values):

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**OR** if you're using Next.js public variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Security Note

⚠️ **Never commit `.env.local` to Git!** It should already be in `.gitignore`.

The `service_role` key has admin access - keep it secret!

