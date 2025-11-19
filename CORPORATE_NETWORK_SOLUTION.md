# Corporate Network Solution

## Issue Identified

You're on a **corporate network** (`NakivoVN.local`) and the firewall is blocking Supabase domains (`*.supabase.co`).

## Why This Happens

Corporate firewalls often block external cloud services for security. Your IT department has likely configured the firewall to block Supabase.

## Immediate Solution: Use Vercel Deployment

Since your Vercel deployment works perfectly, use that:

1. **Access your app on Vercel:**
   - Go to your Vercel dashboard
   - Open the deployed URL
   - Use the admin UI there

2. **All features work on Vercel:**
   - ✅ Supabase connection works
   - ✅ Data sync works
   - ✅ Email sending works
   - ✅ All features functional

3. **For local development:**
   - Use Vercel preview deployments
   - Or work on a different network (home, mobile hotspot)

## Long-Term Solution: Contact IT

Ask your IT department to:

1. **Whitelist Supabase domains:**
   - `*.supabase.co`
   - `*.supabase.in` (if using India region)

2. **Provide proxy configuration** (if required):
   - HTTP_PROXY
   - HTTPS_PROXY
   - NO_PROXY settings

3. **Explain the business need:**
   - You're developing a customer renewal reminder system
   - Supabase is the database backend
   - It's a legitimate business application

## Workaround: Mobile Hotspot

For local development:
- Connect to mobile hotspot
- Supabase will work from there
- Switch back to corporate network when done

## Alternative: VPN

If your company has a VPN:
- Connect via VPN
- May bypass firewall restrictions
- Test if Supabase works through VPN

## Summary

**Use Vercel for now** - it works perfectly there!

Contact IT for long-term solution to unblock Supabase on corporate network.

