# FilmFeed WhatsApp Bot

Automated movie delivery bot for WhatsApp groups.

## Features

- ✅ Receives movie requests from website
- ✅ Downloads movies from multiple sources
- ✅ 2GB file size check
- ✅ Queue system for multiple requests
- ✅ Auto-sends to WhatsApp group
- ✅ Shows requester name
- ✅ Auto-cleanup after upload
- ✅ Error handling and retry logic

## Installation

```bash
npm install
```

## Usage

```bash
node bot.js
```

On first run, scan the QR code with WhatsApp.

## Message Format

Bot expects messages in this format:
```
MovieName|Quality|UniqueToken
```

Example:
```
Avengers Endgame|1080p|abc123xyz456
```

## Configuration

Edit `bot.js`:

```javascript
const GROUP_JID = '120363354181677834@g.us'; // Your group JID
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
```

## File Size Handling

- Files <2GB: Uploaded as document to group
- Files >2GB: Direct download link sent instead

## Queue System

Multiple requests are processed one at a time:
1. User sends request
2. Bot adds to queue
3. Bot sends position update
4. Bot processes when ready
5. Bot notifies completion

## Error Handling

- Network errors: Retry with exponential backoff
- Download errors: Send error message to user
- Upload errors: Try direct link fallback

## Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web API
- `axios` - HTTP client
- `fs-extra` - File system utilities
- `pino` - Logger

## Deployment

### On VPS with PM2:

```bash
pm2 start bot.js --name filmfeed-bot
pm2 startup
pm2 save
```

### Check Status:
```bash
pm2 status
pm2 logs filmfeed-bot
```

## Troubleshooting

### Bot won't connect:
1. Delete `auth_info_baileys` folder
2. Restart bot
3. Scan new QR code

### Movies not downloading:
1. Check scraper scripts in parent directory
2. Verify internet connection
3. Check download URLs

### Files not uploading:
1. Verify group permissions
2. Check file size
3. Check internet speed

## Support

WhatsApp: 076 037 2547
