# FilmFeed - WhatsApp Movie Bot & Website

Complete system for requesting and delivering movies via WhatsApp with a beautiful web interface.

## Features

### Website (FilmFeed)
- 🎬 Browse movies and TV series
- 🔍 Search functionality
- 📱 One-click WhatsApp request
- 💰 Integrated ads on every page
- 🎨 Beautiful Netflix-style UI
- 📊 Movie details with posters and descriptions

### WhatsApp Bot
- 🤖 Automated movie delivery to WhatsApp group
- 📥 Downloads movies from scraped sources
- 📦 Sends as documents to group
- ⚠️ 2GB file size check
- 📊 Queue system for multiple requests
- ✅ Request tracking with user names
- 🗑️ Auto-cleanup after upload

## Setup Instructions

### 1. WhatsApp Bot Setup

```bash
cd "C:\Users\akash\Desktop\New folder (2)\whatsapp-bot"
npm install
node bot.js
```

**First Time:**
- Scan QR code with WhatsApp
- Bot will connect automatically
- Update GROUP_JID in bot.js with your group ID

### 2. Website Setup (Local)

```bash
cd "C:\Users\akash\Desktop\New folder (2)\filmfeed-website"
npm install
npm run dev
```

Website will be available at: http://localhost:3000

### 3. Deploy to Vercel

1. **Create Vercel Project:**
   - Go to https://vercel.com
   - Import your GitHub repo
   - Select `filmfeed-website` directory

2. **Add Environment Variables:**
   - VERCEL_TOKEN: `YOUR_VERCEL_TOKEN`

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### 4. GitHub Setup

1. **Push to GitHub:**
   ```bash
   cd "C:\Users\akash\Desktop\New folder (2)"
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/arapakaya/FILMFEED.git
   git push -u origin main
   ```

2. **Add GitHub Secrets:**
   - Go to repo Settings → Secrets
   - Add `VERCEL_TOKEN`
   - Add `VERCEL_ORG_ID`
   - Add `VERCEL_PROJECT_ID`
   - Add `GITHUB_TOKEN`: `YOUR_GITHUB_TOKEN`

## How It Works

### User Flow:
1. User visits FilmFeed website
2. Searches for a movie
3. Clicks movie → sees details page
4. Clicks "REQUEST MOVIE TO WHATSAPP" button
5. Selects quality (480p, 720p, 1080p, 4K)
6. WhatsApp opens with pre-filled message: `MovieName|Quality|UniqueToken`
7. Message sends to bot (0760372547)

### Bot Flow:
1. Bot receives request message
2. Parses: Movie name, Quality, Token
3. Adds to queue
4. Searches movie using scrapers
5. Downloads movie
6. Checks file size (<2GB)
7. If >2GB: Sends direct link instead
8. If <=2GB: Uploads to group as document
9. Sends movie poster + description
10. Deletes file from VPS
11. Processes next request in queue

## File Structure

```
New folder (2)/
├── whatsapp-bot/
│   ├── bot.js (Main bot logic)
│   ├── search_movie.py (Movie search integration)
│   ├── package.json
│   └── auth_info_baileys/ (Generated on first run)
│
├── filmfeed-website/
│   ├── app/
│   │   ├── page.tsx (Homepage)
│   │   ├── movie/[id]/page.tsx (Movie details)
│   │   ├── api/movies/ (API routes)
│   │   ├── components/
│   │   └── layout.tsx
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── vercel.json
│
├── Enhanced scrapers (from previous)
├── cinesubz_result.json (Movie database)
└── README.md
```

## Environment Variables

### Website (.env.local)
```
NEXT_PUBLIC_BOT_NUMBER=94760372547
```

### Bot
```
GROUP_JID=120363354181677834@g.us
DOWNLOAD_DIR=./downloads
MAX_FILE_SIZE=2147483648
```

## API Endpoints

### GET /api/movies
Returns all available movies

### GET /api/movies/[id]
Returns specific movie details

## Bot Commands

Bot automatically processes messages in format:
```
MovieName|Quality|Token
```

Example:
```
Avengers Endgame|1080p|abc123xyz456
```

## Queue System

- Multiple users can request simultaneously
- Requests processed one at a time
- Users get position updates
- Requester name shown in messages

## File Size Handling

- Files <2GB: Uploaded as document
- Files >2GB: Direct download link sent
- Message shows file size before download

## Ads Integration

Ads appear on:
- Every page (header)
- Homepage (3 locations)
- Movie details page (3 locations)
- Search results

## Technologies Used

### Website:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Vercel (hosting)

### Bot:
- Node.js
- @whiskeysockets/baileys (WhatsApp library)
- Axios (downloads)
- fs-extra (file management)

### Scrapers:
- Python 3
- BeautifulSoup4
- Requests

## Troubleshooting

### Bot not connecting:
- Delete `auth_info_baileys` folder
- Restart bot
- Scan new QR code

### Movies not found:
- Check scrapers in parent directory
- Update cinesubz_result.json
- Verify search_movie.py

### File upload fails:
- Check file size (<2GB)
- Verify group permissions
- Check internet connection

### Website not deploying:
- Verify Vercel token
- Check build logs
- Ensure all files committed

## Support

WhatsApp: 076 037 2547
GitHub: https://github.com/arapakaya/FILMFEED

## License

MIT License - Free to use and modify

---

**Created by Mahi**
**Powered by FilmFeed™**
