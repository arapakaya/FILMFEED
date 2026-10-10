# GitHub Actions Setup - FilmFeed

## මේවා GitHub එකේ තියන්න ඕනෙ

### 1. Repository Secrets

GitHub repo එකේ Settings → Secrets and variables → Actions

**Add these secrets:**

```
Name: VERCEL_TOKEN
Value: YOUR_VERCEL_TOKEN_HERE

Name: VERCEL_ORG_ID
Value: (Get from Vercel dashboard → Settings → General)

Name: VERCEL_PROJECT_ID  
Value: (Get from Vercel project → Settings → General)

Name: GROUP_JID
Value: 120363354181677834@g.us
```

---

## 2. Upload to GitHub

```powershell
cd "C:\Users\akash\Desktop\New folder (2)"

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "FilmFeed Bot and Website - Initial Commit"

# Add remote
git remote add origin https://github.com/arapakaya/FILMFEED.git

# Set git credentials
git config user.name "arapakaya"
git config user.email "your-email@example.com"

# Push
git push -u origin main
```

---

## 3. First Time Bot Connection

**Bot needs to connect once manually:**

```powershell
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
node bot.js
```

1. QR එක scan කරන්න
2. Bot connect වෙනකන් පොඩ්ඩක් ඉන්න
3. `auth_info_baileys` folder එක create වෙයි
4. Ctrl+C press කරන්න bot එක stop කරන්න

---

## 4. Upload Auth Session to GitHub

```powershell
cd "C:\Users\akash\Desktop\New folder (2)"

# Commit auth folder
git add whatsapp-bot/auth_info_baileys
git commit -m "Add WhatsApp auth session"
git push
```

⚠️ **Private repo එකක් විතරයි use කරන්න!**

---

## 5. GitHub Actions Will:

### Bot Workflow:
- ✅ Run bot 24/7 in cloud
- ✅ Auto-restart every 6 hours
- ✅ Keep auth session
- ✅ Process movie requests
- ✅ Download and upload to group

### Website Workflow:
- ✅ Auto-deploy on every push
- ✅ Deploy to Vercel
- ✅ Live website link

---

## 6. How It Works:

### When you push code:
```powershell
git add .
git commit -m "Update"
git push
```

1. GitHub Actions starts automatically
2. Website deploys to Vercel
3. Bot starts running
4. Everything works in cloud!

---

## 7. Monitor Actions:

GitHub repo → Actions tab

You'll see:
- 🟢 Bot running status
- 🟢 Website deployment status
- 📋 Logs

---

## 8. Manual Trigger:

GitHub → Actions → Select workflow → Run workflow

---

## Alternative: Vercel CLI Deploy

```powershell
cd filmfeed-website
npm install -g vercel
vercel login
vercel --prod
```

---

## Get Vercel IDs:

### Org ID:
1. https://vercel.com/account
2. Settings → General
3. Copy "Team ID" or "User ID"

### Project ID:
1. Open your project in Vercel
2. Settings → General
3. Copy "Project ID"

---

## Important Notes:

1. **Bot එක private repo එකක තියන්න** - auth session එක secure කරගන්න
2. **Secrets verify කරන්න** - GitHub secrets හරියටම add වෙලාද බලන්න
3. **Actions enable කරන්න** - Repo settings → Actions → Allow all actions
4. **Auth session backup කරන්න** - `auth_info_baileys` folder එක local එකේ තියන්න

---

## Troubleshooting:

### Bot not connecting:
- Check GROUP_JID in secrets
- Verify auth session uploaded
- Check Actions logs

### Website not deploying:
- Check VERCEL_TOKEN
- Verify build succeeds locally
- Check deployment logs

### Auth expired:
```powershell
cd whatsapp-bot
rm -rf auth_info_baileys
node bot.js
# Scan QR again
# Push to GitHub
```

---

**🚀 Now everything runs in cloud!**
**📱 No need to keep computer on!**
**✅ Bot runs 24/7 automatically!**
