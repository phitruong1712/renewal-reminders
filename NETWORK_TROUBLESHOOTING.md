# Network Troubleshooting Guide

## Issue: Cannot connect to Supabase

**Error:** `TypeError: fetch failed` - DNS resolution failure

**Root Cause:** Your computer cannot resolve the Supabase domain name `vnitqugocqtrvkmanucq.supabase.co` to an IP address.

## Solutions

### 1. Check DNS Settings

**Windows:**
1. Open Network Settings
2. Go to "Change adapter options"
3. Right-click your network adapter → Properties
4. Select "Internet Protocol Version 4 (TCP/IPv4)" → Properties
5. Try using Google DNS:
   - Preferred DNS: `8.8.8.8`
   - Alternate DNS: `8.8.4.4`
6. Click OK and restart your network adapter

### 2. Flush DNS Cache

Open PowerShell as Administrator and run:
```powershell
ipconfig /flushdns
```

### 3. Check Firewall/Antivirus

- Temporarily disable firewall/antivirus to test
- Add Node.js to firewall exceptions
- Check if corporate firewall is blocking Supabase

### 4. Check Network Connection

- Try accessing https://vnitqugocqtrvkmanucq.supabase.co in a web browser
- If browser also fails, it's a network/DNS issue
- Try from a different network (mobile hotspot) to test

### 5. Corporate Network/VPN

If you're on a corporate network:
- Check with IT if Supabase is blocked
- Try connecting via VPN or different network
- Ask IT to whitelist `*.supabase.co` domains

### 6. Test DNS Resolution

Run in PowerShell:
```powershell
Resolve-DnsName vnitqugocqtrvkmanucq.supabase.co
```

If this fails, DNS is the issue.

## Quick Test

1. Open browser and go to: https://vnitqugocqtrvkmanucq.supabase.co
2. If browser can't load it → Network/DNS issue
3. If browser loads it → Node.js/fetch configuration issue

## Alternative: Use Vercel Deployment

Since this works on Vercel, you can:
- Deploy to Vercel (it will work there)
- Use Vercel's preview deployments for testing
- Sync data via the Vercel-hosted admin UI

## Contact

If none of these work, contact your network administrator or IT support.




