# Fix Network/DNS Issue for Supabase

## Problem
- Supabase project exists and is active
- Cannot access from browser (DNS_PROBE_FINISHED_NXDOMAIN)
- Cannot connect from Node.js/Next.js app

## This is a Network/DNS Issue

Since the project exists in Supabase dashboard but you can't access it, this is a **local network configuration issue**.

## Solutions (Try in Order)

### Solution 1: Flush DNS Cache (Run as Administrator)

```powershell
# Open PowerShell as Administrator
ipconfig /flushdns
ipconfig /registerdns
ipconfig /release
ipconfig /renew
netsh winsock reset
```

Then restart your computer.

### Solution 2: Change DNS Servers

**Windows:**
1. Open "Network and Sharing Center"
2. Click on your active connection
3. Click "Properties"
4. Select "Internet Protocol Version 4 (TCP/IPv4)"
5. Click "Properties"
6. Select "Use the following DNS server addresses"
7. Enter:
   - **Preferred:** `8.8.8.8` (Google DNS)
   - **Alternate:** `1.1.1.1` (Cloudflare DNS)
8. Click OK and restart your network adapter

### Solution 3: Check Corporate Firewall/Proxy

If you're on a corporate network:
- Contact IT to whitelist `*.supabase.co` domains
- Ask if there's a proxy that needs configuration
- Check if VPN is interfering

### Solution 4: Try Different Network

- Connect to mobile hotspot
- Try from home network
- Use a different WiFi network

### Solution 5: Configure Proxy (If Required)

If your network requires a proxy, you may need to configure Node.js:

Create or update `.env.local`:
```env
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1
```

### Solution 6: Use Vercel Deployment (Workaround)

Since Vercel works, you can:
1. Deploy to Vercel (it will work there)
2. Use Vercel's admin UI to manage data
3. Sync data via Vercel deployment

### Solution 7: Check Windows Hosts File

Check if `C:\Windows\System32\drivers\etc\hosts` has any entries blocking Supabase.

## Quick Test Commands

```powershell
# Test DNS resolution
nslookup vnitqugocqtrvkmanucq.supabase.co 8.8.8.8

# Test with different DNS
nslookup vnitqugocqtrvkmanucq.supabase.co 1.1.1.1

# Test connectivity
Test-NetConnection -ComputerName vnitqugocqtrvkmanucq.supabase.co -Port 443
```

## Most Likely Cause

If you're on a **corporate network**, the firewall is likely blocking Supabase domains. Contact your IT department to:
- Whitelist `*.supabase.co`
- Configure proxy settings if needed
- Check if VPN is causing issues

## Alternative: Use Vercel

Since your Vercel deployment works, you can:
- Use the Vercel-hosted admin UI
- All Supabase connections will work from Vercel
- Sync data via the deployed app




