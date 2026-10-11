const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');

// Configuration
const GROUP_JID = process.env.GROUP_JID || ''; // Optional Group JID
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// In-memory queue & user request tracking
const requestQueue = [];
let isProcessing = false;
const userRequestCounts = {}; // { userJid: count }

// Ensure download directory exists
fs.ensureDirSync(DOWNLOAD_DIR);

/**
 * Searches for movie / TV series details and direct link using Python scraper
 */
async function searchMovieWithScraper(movieName, quality) {
    const scraperScript = path.join(__dirname, 'search_movie.py');
    const cmd = `python "${scraperScript}" "${movieName.replace(/"/g, '\\"')}" "${quality || '720p'}"`;

    return new Promise((resolve) => {
        exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Scraper execution error:', stderr || error.message);
                resolve(null);
                return;
            }

            try {
                const result = JSON.parse(stdout);
                if (result && result.success) {
                    resolve(result);
                } else {
                    console.log('Scraper returned no match:', result ? result.error : 'Unknown error');
                    resolve(null);
                }
            } catch (e) {
                console.error('Failed to parse scraper output:', stdout);
                resolve(null);
            }
        });
    });
}

/**
 * Downloads movie from direct link with size checking
 */
async function downloadMovie(url, filename) {
    const filePath = path.join(DOWNLOAD_DIR, filename);

    try {
        console.log(`Downloading: ${filename}`);

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 1800000, // 30 mins
            maxRedirects: 10,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);

        if (totalSize > MAX_FILE_SIZE) {
            throw new Error(`File size (${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB) exceeds WhatsApp 2GB limit`);
        }

        const writer = fs.createWriteStream(filePath);
        let downloadedSize = 0;

        response.data.on('data', (chunk) => {
            downloadedSize += chunk.length;
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✓ Download finished: ${filename}`);
                resolve({ filePath, size: downloadedSize || totalSize });
            });
            writer.on('error', (err) => {
                fs.removeSync(filePath);
                reject(err);
            });
        });
    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.removeSync(filePath);
        }
        throw error;
    }
}

/**
 * Processes a single movie request sequentially
 */
async function processRequest(sock, request) {
    const { chatId, movieName, quality, token, requesterName, requestNum } = request;

    // ALWAYS reply directly to chatId (where request came from)
    const targetJid = chatId;

    try {
        console.log(`\n--- Processing Request #${requestNum} for ${requesterName}: ${movieName} (${quality}) in ${chatId} ---`);

        await sock.sendMessage(targetJid, {
            text: `🎬 *Processing Request #${requestNum}*\n` +
                  `👤 *Requested by*: ${requesterName}\n` +
                  `🍿 *Movie/Series*: ${movieName}\n` +
                  `🎥 *Quality*: ${quality}\n\n` +
                  `⏳ Searching database & generating direct download link...`
        });

        const movieDetails = await searchMovieWithScraper(movieName, quality);

        if (!movieDetails || !movieDetails.downloadUrl) {
            await sock.sendMessage(targetJid, {
                text: `❌ Sorry *${requesterName}*, could not find "${movieName}".\n\n` +
                      `Please check title on https://filmfeed-website.vercel.app`
            });
            return;
        }

        // 2GB Size Check BEFORE downloading
        const fileSize = movieDetails.size_bytes || 0;
        if (fileSize > MAX_FILE_SIZE) {
            const sizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
            await sock.sendMessage(targetJid, {
                text: `⚠️ *File Exceeds WhatsApp 2GB Limit!*\n\n` +
                      `🎬 *Title*: ${movieDetails.title}\n` +
                      `🎥 *Quality*: ${movieDetails.quality || quality}\n` +
                      `📦 *Size*: ${movieDetails.size_text || sizeGB + ' GB'}\n` +
                      `👤 *Requested by*: ${requesterName} (Request #${requestNum})\n\n` +
                      `❌ WhatsApp cannot upload files larger than 2 GB.\n\n` +
                      `🔗 *Direct Download Link*:\n${movieDetails.downloadUrl}`
            });
            return;
        }

        // Step 1: Send Poster with Details first
        let detailsCaption = `🎬 *${movieDetails.title}*\n\n`;
        if (movieDetails.description) {
            const shortDesc = movieDetails.description.length > 350
                ? movieDetails.description.substring(0, 350) + '...'
                : movieDetails.description;
            detailsCaption += `📝 ${shortDesc}\n\n`;
        }
        detailsCaption += `🎥 *Quality*: ${movieDetails.quality || quality}\n`;
        detailsCaption += `📦 *Size*: ${movieDetails.size_text || 'Under 2 GB'}\n`;
        detailsCaption += `👤 *Requested by*: ${requesterName} (Request #${requestNum})\n\n`;
        detailsCaption += `⏳ *Downloading file to server... Please wait!*`;

        if (movieDetails.poster) {
            await sock.sendMessage(targetJid, {
                image: { url: movieDetails.poster },
                caption: detailsCaption
            });
        } else {
            await sock.sendMessage(targetJid, { text: detailsCaption });
        }

        // Step 2: Download file
        const cleanName = movieName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${cleanName}_${quality}_filmfeed.mp4`;
        const { filePath, size } = await downloadMovie(movieDetails.downloadUrl, filename);

        if (size > MAX_FILE_SIZE) {
            await sock.sendMessage(targetJid, {
                text: `⚠️ *File Exceeds 2GB Limit!*\n\nDirect Download Link:\n${movieDetails.downloadUrl}`
            });
            await fs.remove(filePath);
            return;
        }

        // Step 3: Upload Document
        await sock.sendMessage(targetJid, {
            text: `📤 *Uploading file to WhatsApp...*`
        });

        await sock.sendMessage(targetJid, {
            document: { url: filePath },
            fileName: `${movieDetails.title}_${quality}.mp4`,
            mimetype: 'video/mp4',
            caption: `🎬 *${movieDetails.title}*\n🎥 Quality: ${quality}\n👤 Requested by: ${requesterName}`
        });

        // Also forward copy to GROUP_JID if defined and different from targetJid
        if (GROUP_JID && GROUP_JID !== targetJid) {
            try {
                await sock.sendMessage(GROUP_JID, {
                    document: { url: filePath },
                    fileName: `${movieDetails.title}_${quality}.mp4`,
                    mimetype: 'video/mp4',
                    caption: `🎬 *${movieDetails.title}*\n🎥 Quality: ${quality}\n👤 Requested by: ${requesterName}`
                });
            } catch (e) {
                console.log('Group forward notice:', e.message);
            }
        }

        // Step 4: Delete file immediately
        await fs.remove(filePath);
        console.log(`✓ Deleted local file: ${filePath}`);

        // Step 5: Send Success Message
        await sock.sendMessage(targetJid, {
            text: `✅ *${requesterName}*, your movie "${movieDetails.title}" is uploaded!\n\n🍿 Enjoy watching!`
        });

    } catch (error) {
        console.error('Error processing request:', error);
        await sock.sendMessage(targetJid, {
            text: `❌ Error processing "${movieName}" for *${requesterName}*:\n${error.message}`
        });
    }
}

/**
 * Process queue sequentially
 */
async function processQueue(sock) {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const request = requestQueue.shift();

    try {
        await processRequest(sock, request);
    } catch (error) {
        console.error('Queue error:', error);
    }

    isProcessing = false;

    if (requestQueue.length > 0) {
        setTimeout(() => processQueue(sock), 1500);
    }
}

function parseMovieRequest(message) {
    if (!message || typeof message !== 'string') return null;

    let cleanMsg = message.replace(/^(FilmFeed\s+)?Request:\s*/i, '').trim();
    const parts = cleanMsg.split('|').map(p => p.trim());

    if (parts.length >= 2) {
        let movieName = parts[0];
        let quality = parts[1].replace(/^Quality:\s*/i, '').trim();
        let token = parts[2] ? parts[2].replace(/^Token:\s*/i, '').trim() : '';

        if (movieName && quality) {
            return { movieName, quality, token };
        }
    } else if (parts.length === 1 && cleanMsg.length > 2) {
        return { movieName: cleanMsg, quality: '720p', token: 'direct' };
    }

    return null;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['FilmFeed Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n==========================================');
            console.log('--- SCAN WHATSAPP QR CODE BELOW ---');
            qrcode.generate(qr, { small: true });
            console.log('==========================================\n');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(startBot, 3000);
            }
        } else if (connection === 'open') {
            console.log('==========================================');
            console.log('✓ FilmFeed WhatsApp Bot Connected Successfully!');
            console.log('==========================================');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const messageText = msg.message.conversation ||
                          msg.message.extendedTextMessage?.text ||
                          msg.message.imageMessage?.caption || '';

        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || 'Member';

        console.log(`Received message from ${pushName} (${chatId}): "${messageText}"`);

        const request = parseMovieRequest(messageText);

        if (request) {
            console.log(`✓ Parsed Movie Request: "${request.movieName}" (${request.quality})`);
            userRequestCounts[senderJid] = (userRequestCounts[senderJid] || 0) + 1;
            const requestNum = userRequestCounts[senderJid];

            requestQueue.push({
                chatId,
                ...request,
                requesterName: pushName,
                requesterJid: senderJid,
                requestNum
            });

            const queuePosition = requestQueue.length;

            if (queuePosition === 1 && !isProcessing) {
                await sock.sendMessage(chatId, {
                    text: `✅ *Request Received!*\n\n` +
                          `🎬 *Movie*: ${request.movieName}\n` +
                          `🎥 *Quality*: ${request.quality}\n` +
                          `👤 *Requested by*: ${pushName} (Request #${requestNum})\n` +
                          `📊 *Status*: Processing now...`
                });

                processQueue(sock);
            } else {
                await sock.sendMessage(chatId, {
                    text: `✅ *Request Queued!*\n\n` +
                          `🎬 *Movie*: ${request.movieName}\n` +
                          `🎥 *Quality*: ${request.quality}\n` +
                          `👤 *Requested by*: ${pushName} (Request #${requestNum})\n` +
                          `📊 *Queue Position*: #${queuePosition}\n\n` +
                          `⏳ Please wait, movies are processed sequentially...`
                });
            }
        }
    });
}

// Start
console.log('🤖 Starting FilmFeed Bot in GitHub Actions...');
startBot().catch(console.error);
