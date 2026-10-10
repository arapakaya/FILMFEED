# FilmFeed - සම්පූර්ණ මාර්ගෝපදේශය 🎬

## පියවර 1: Bot එක Local එකේ Connect කරන්න

```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
npm install
node bot.js
```

**QR Code එක Scan කරන්න:**
- Terminal එකේ QR code පෙන්වයි
- WhatsApp → Settings → Linked Devices → Link a Device
- Scan කරන්න
- Bot connect වෙනකන් ඉන්න (පොඩ්ඩක් කාලය යයි)

✅ "Bot connected successfully!" කියලා පෙන්වයි

**දැන් Ctrl+C press කරන්න bot එක stop කරන්න**

---

## පියවර 2: GitHub එකට Upload කරන්න

```powershell
cd "C:\Users\akash\Desktop\New folder (2)"

git init
git add .
git commit -m "FilmFeed Bot and Website"
git remote add origin https://github.com/arapakaya/FILMFEED.git
git push -u origin main
```

---

## පියවර 3: GitHub Secrets Add කරන්න

https://github.com/arapakaya/FILMFEED → Settings → Secrets → Actions

**Add these 4 secrets:**

1. **Name:** `VERCEL_TOKEN`  
   **Value:** `YOUR_VERCEL_TOKEN`

2. **Name:** `GROUP_JID`  
   **Value:** `120363354181677834@g.us` (ඔබේ group JID එක)

3. **Name:** `VERCEL_ORG_ID`  
   **Value:** Vercel dashboard එකෙන් ගන්න

4. **Name:** `VERCEL_PROJECT_ID`  
   **Value:** Vercel project settings එකෙන් ගන්න

---

## පියවර 4: GitHub Actions Enable කරන්න

Repo → Settings → Actions → General

- ✅ Allow all actions and reusable workflows
- Save කරන්න

---

## පියවර 5: Bot Start වෙයි Automatically!

GitHub → Actions tab එකට යන්න

දැන් පෙන්වයි:
- 🟢 WhatsApp Bot - 24/7 (running)
- 🟢 Deploy Website to Vercel (running)

**පොඩ්ඩක් ඉන්න...**

✅ Bot cloud එකේ run වෙනව!  
✅ Website Vercel එකේ deploy වෙනව!

---

## පියවර 6: Vercel Link එක ගන්න

Actions → Deploy Website to Vercel → Latest run → Logs

Link එක පෙන්වයි:
```
https://filmfeed-xxx.vercel.app
```

---

## දැන් System එක Complete! 🎉

### Bot (GitHub Actions එකේ run වෙනවා):
- ✅ 24/7 running
- ✅ Movie requests listen කරනවා
- ✅ Downloads and uploads
- ✅ Auto-restarts every 6 hours

### Website (Vercel එකේ):
- ✅ Live and public
- ✅ Search movies
- ✅ Request to WhatsApp button
- ✅ Auto-deploys on every push

---

## භාවිතා කරන්නේ කොහොමද:

### User Experience:
1. User opens: `https://your-site.vercel.app`
2. Searches: "Avengers"
3. Clicks movie → Movie details
4. Clicks "REQUEST TO WHATSAPP"
5. Selects quality: 1080p
6. WhatsApp opens with message
7. Sends to: 076 037 2547

### Bot Response:
1. ✅ Bot receives message
2. ✅ Parses: Movie|Quality|Token
3. ✅ Searches in scrapers
4. ✅ Downloads movie
5. ✅ Checks size (<2GB?)
6. ✅ Uploads to group as document
7. ✅ Deletes file
8. ✅ Ready for next request

---

## Group JID එක හොයාගන්න කොහොමද:

Bot run වෙද්දී, ඔබේ group එකට මේ message එක යවන්න:
```
!getgroupid
```

Bot reply කරයි group JID එකත් එක්ක.

Copy කරගෙන GitHub secret එකේ update කරන්න.

---

## Local Testing:

Website test කරන්න:
```powershell
cd filmfeed-website
npm install
npm run dev
```
Open: http://localhost:3000

Bot test කරන්න:
```powershell
cd whatsapp-bot
node bot.js
```

---

## Update කරන්න:

Code එකක් change කළාම:

```powershell
cd "C:\Users\akash\Desktop\New folder (2)"
git add .
git commit -m "Updated feature"
git push
```

✅ GitHub Actions automatically deploy කරයි!

---

## Logs බලන්න:

GitHub → Actions → Select run → Logs

දකින්න පුළුවන්:
- Bot connection status
- Movie download progress
- Upload status
- Errors (if any)

---

## Troubleshooting:

### Bot offline වුනාම:
- GitHub Actions → Re-run workflow
- හෝ auth session එක refresh කරන්න

### Website down නම්:
- Vercel dashboard බලන්න
- Build logs check කරන්න

### Movies download නෑ නම්:
- Scraper scripts check කරන්න
- `scrape_movies.py` update කරන්න

---

## Important Files:

```
New folder (2)/
├── .github/workflows/
│   ├── whatsapp-bot.yml (Bot runner)
│   └── deploy-website.yml (Website deployer)
│
├── whatsapp-bot/
│   ├── bot-action.js (GitHub Actions bot)
│   ├── bot.js (Local bot)
│   └── auth_info_baileys/ (Auth session)
│
├── filmfeed-website/
│   ├── app/ (Next.js pages)
│   └── public/ (Static files)
│
└── Enhanced scrapers (Python)
```

---

## API Routes:

### Anime:
```
GET https://your-site.vercel.app/api/scrape/anime?q=naruto&limit=10
```

### Movies:
```
GET https://your-site.vercel.app/api/scrape/cartoons?q=avengers&limit=10
```

---

## Support:

**WhatsApp:** 076 037 2547  
**GitHub:** https://github.com/arapakaya/FILMFEED

---

## මතක තබාගන්න:

1. ✅ Private repo එකක තියන්න (auth session එක secure කරන්න)
2. ✅ Secrets හරියටම add වෙලාද බලන්න
3. ✅ Bot connect කරන්න පස්සේ එකවරම GitHub එකට push කරන්න
4. ✅ Actions enable කරන්න
5. ✅ Group JID එක හරි වෙලාද බලන්න

---

**🎬 ඔබේ FilmFeed Bot දැන් Live!**  
**🚀 24/7 Cloud එකේ Run වෙනවා!**  
**📱 කම්පියුටර් on කරන්න අවශ්‍ය නෑ!**  
**✅ Everything Automated!**
