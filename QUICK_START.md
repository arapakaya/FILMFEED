# 🚀 Quick Start Guide - FilmFeed

## Step 1: Install Everything

### Website:
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\filmfeed-website"
npm install
```

### WhatsApp Bot:
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
npm install
```

---

## Step 2: Start WhatsApp Bot

```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
node bot.js
```

**QR Code එක Scan කරන්න:**
1. Terminal එකේ QR code එක පෙන්වයි
2. WhatsApp App → Settings → Linked Devices → Link a Device
3. Scan කරන්න

✅ Bot connected වෙයි!

---

## Step 3: Test Website Locally

```powershell
cd "C:\Users\akash\Desktop\New folder (2)\filmfeed-website"
npm run dev
```

Open: http://localhost:3000

---

## Step 4: Deploy to Vercel

### Option A: Using Script (Easy)
```powershell
cd "C:\Users\akash\Desktop\New folder (2)"
.\deploy.ps1
```

### Option B: Manual
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\filmfeed-website"
npm install -g vercel
$env:VERCEL_TOKEN="YOUR_VERCEL_TOKEN_HERE"
vercel --token $env:VERCEL_TOKEN --prod --yes
```

✅ Website live වෙයි!

---

## Step 5: Push to GitHub

```powershell
cd "C:\Users\akash\Desktop\New folder (2)"
git init
git add .
git commit -m "FilmFeed initial commit"
git remote add origin https://github.com/arapakaya/FILMFEED.git
git push -u origin main
```

---

## API Endpoints (Ready to Use)

### Get Anime:
```
GET /api/scrape/anime?q=naruto&limit=10
```

### Get Movies:
```
GET /api/scrape/cartoons?q=avengers&limit=10
```

### Get All Movies:
```
GET /api/movies
```

---

## Test Flow:

1. ✅ Open website → http://localhost:3000
2. ✅ Search movie → "Avengers"
3. ✅ Click movie → Movie details page
4. ✅ Click "REQUEST TO WHATSAPP" button
5. ✅ Select quality → 1080p
6. ✅ WhatsApp opens → Message ready
7. ✅ Send to 076 037 2547
8. ✅ Bot receives message
9. ✅ Bot downloads movie
10. ✅ Bot sends to group

---

## Your Credentials:

**Vercel:**
- Token: Get from https://vercel.com/account/tokens

**GitHub:**
- Repo: https://github.com/arapakaya/FILMFEED
- Token: Get from GitHub Settings → Developer settings → Personal access tokens

**WhatsApp Bot:**
- Number: 076 037 2547 (0760372547)

---

## Troubleshooting:

### Bot won't start:
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
Remove-Item -Recurse -Force auth_info_baileys
node bot.js
```

### Website won't build:
```powershell
cd filmfeed-website
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next
npm install
npm run build
```

### Deployment fails:
- Check internet connection
- Verify Vercel token
- Check build logs

---

## Support:

**WhatsApp:** 076 037 2547  
**GitHub:** https://github.com/arapakaya/FILMFEED

---

**🎬 FilmFeed - Your Movies, Your Way!**
