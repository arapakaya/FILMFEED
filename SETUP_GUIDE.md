# ස්ථාපන මාර්ගෝපදේශය (Setup Guide in Sinhala)

## 1. WhatsApp Bot එක Setup කරන්න

### පියවර 1: Bot Folder එකට යන්න
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
```

### පියවර 2: Dependencies Install කරන්න
```powershell
npm install
```

### පියවර 3: Bot එක Start කරන්න
```powershell
node bot.js
```

### පියවර 4: WhatsApp QR Code එක Scan කරන්න
- Terminal එකේ QR code එකක් පෙනෙයි
- ඔබේ WhatsApp app එකෙන් scan කරන්න
- Settings → Linked Devices → Link a Device

### පියවර 5: Group JID එක හොයාගන්න
Bot connect වුනාම, ඔබේ group එකට මේ message එක යවන්න:
```
!getgroupid
```

Group JID එක copy කරගෙන `bot.js` file එකේ මේ line එක update කරන්න:
```javascript
const GROUP_JID = 'YOUR_GROUP_JID_HERE@g.us';
```

---

## 2. Website එක Setup කරන්න

### පියවර 1: Website Folder එකට යන්න
```powershell
cd "C:\Users\akash\Desktop\New folder (2)\filmfeed-website"
```

### පියවර 2: Dependencies Install කරන්න
```powershell
npm install
```

### පියවර 3: Local එකේ Run කරන්න
```powershell
npm run dev
```

Website එක ලබාගන්න: http://localhost:3000

---

## 3. GitHub එකට Upload කරන්න

### පියවර 1: Git Initialize කරන්න
```powershell
cd "C:\Users\akash\Desktop\New folder (2)"
git init
```

### පියවර 2: GitHub Repository එක Add කරන්න
```powershell
git remote add origin https://github.com/arapakaya/FILMFEED.git
```

### පියවර 3: Files Add කරන්න
```powershell
git add .
git commit -m "Initial commit - FilmFeed Bot and Website"
```

### පියවර 4: Push කරන්න
```powershell
git push -u origin main
```

---

## 4. Vercel එකට Deploy කරන්න

### Option 1: Vercel CLI භාවිතා කරන්න

```powershell
npm install -g vercel
cd filmfeed-website
vercel login
vercel --prod
```

### Option 2: Vercel Website එකෙන්

1. https://vercel.com එකට යන්න
2. "Import Project" click කරන්න
3. GitHub repo එක select කරන්න
4. Root Directory: `filmfeed-website`
5. Framework Preset: Next.js
6. Deploy click කරන්න

---

## 5. VPS එකේ Bot Run කරන්න

### PM2 භාවිතා කරන්න (Recommended)

```bash
# PM2 Install කරන්න
npm install -g pm2

# Bot Start කරන්න
cd /path/to/whatsapp-bot
pm2 start bot.js --name filmfeed-bot

# Auto-restart enable කරන්න
pm2 startup
pm2 save

# Status බලන්න
pm2 status

# Logs බලන්න
pm2 logs filmfeed-bot
```

---

## 6. GitHub Actions Setup කරන්න

### පියවර 1: Repository Secrets Add කරන්න

GitHub repo එකේ:
1. Settings → Secrets and variables → Actions
2. "New repository secret" click කරන්න

Add these secrets:
- `VERCEL_TOKEN`: YOUR_VERCEL_TOKEN_HERE
- `VERCEL_ORG_ID`: (Get from Vercel dashboard)
- `VERCEL_PROJECT_ID`: (Get from Vercel project settings)

### පියවර 2: Workflow Verify කරන්න
```powershell
git add .github/workflows/deploy.yml
git commit -m "Add deployment workflow"
git push
```

---

## 7. Test කරන්න

### Bot Test කරන්න:
1. Bot number එකට WhatsApp message එකක් යවන්න:
   ```
   Avengers Endgame|1080p|test123
   ```
2. Bot එක reply කරයිද බලන්න
3. Group එකට movie එක වැටුනාද බලන්න

### Website Test කරන්න:
1. Browser එකෙන් website එකට යන්න
2. Movie එකක් search කරන්න
3. Movie details page එකට යන්න
4. "REQUEST TO WHATSAPP" button එක click කරන්න
5. Quality select කරන්න
6. WhatsApp open වෙනවද බලන්න

---

## දැන් ඔබේ System එක සම්පූර්ණයි! 🎉

### භාවිතා කරන්නේ කොහොමද:

1. **User visits website** → FilmFeed.vercel.app
2. **Searches movie** → "Avengers"
3. **Clicks movie** → Movie details page
4. **Clicks request button** → Quality selection
5. **Selects quality** → WhatsApp opens
6. **Sends message** → Bot receives
7. **Bot downloads** → Movie file
8. **Bot uploads** → Group එකට
9. **User downloads** → From group

### වැඩිදුර උදවු අවශ්‍ය නම්:

WhatsApp: 076 037 2547
GitHub: https://github.com/arapakaya/FILMFEED

---

**සුබ පැතුම්! FilmFeed Bot ඔබ සතු වෙනවා! 🎬🤖**
