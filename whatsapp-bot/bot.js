const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

// Configuration
const GROUP_JID = process.env.GROUP_JID || '120363354181677834@g.us'; // WhatsApp Group JID
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit in bytes

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

    return new Promise((resolve, reject) => {
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
        console.log(`Downloading: ${filename} from ${url}`);

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 1800000, // 30 mins
            maxRedirects: 10,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
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
            if (totalSize > 0) {
                const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                process.stdout.write(`\rDownloading ${filename}: ${progress}%`);
            }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`\n✓ Download finished: ${filename}`);
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
    const { chatId, movieName, quality, token, requesterName, requesterJid, requestNum } = request;
    const targetJid = GROUP_JID || chatId;

    try {
        console.log(`\n--- Processing Request #${requestNum} for ${requesterName}: ${movieName} (${quality}) ---`);

        // Send processing status
        await sock.sendMessage(targetJid, {
            text: `🎬 *Processing Request #${requestNum}*\n` +
                  `👤 *Requested by*: ${requesterName}\n` +
                  `🍿 *Movie/Series*: ${movieName}\n` +
                  `🎥 *Quality*: ${quality}\n\n` +
                  `⏳ Searching database & generating direct download link...`
        });

        // Search for movie details
        const movieDetails = await searchMovieWithScraper(movieName, quality);

        if (!movieDetails || !movieDetails.downloadUrl) {
            await sock.sendMessage(targetJid, {
                text: `❌ Sorry *${requesterName}*, could not find "${movieName}".\n\n` +
                      `Please check the spelling or search on https://filmfeed.vercel.app`
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

        // Step 2: Download file to server
        const cleanName = movieName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${cleanName}_${quality}_filmfeed.mp4`;
        const { filePath, size } = await downloadMovie(movieDetails.downloadUrl, filename);

        // Double check size after download
        if (size > MAX_FILE_SIZE) {
            const downloadedSizeGB = (size / (1024 * 1024 * 1024)).toFixed(2);
            await sock.sendMessage(targetJid, {
                text: `⚠️ *File Size (${downloadedSizeGB} GB) Exceeds 2GB Limit!*\n\n` +
                      `Direct Download Link:\n${movieDetails.downloadUrl}`
            });
            await fs.remove(filePath);
            return;
        }

        // Step 3: Upload as Document to WhatsApp
        await sock.sendMessage(targetJid, {
            text: `📤 *Uploading file to WhatsApp group...*`
        });

        await sock.sendMessage(targetJid, {
            document: { url: filePath },
            fileName: `${movieDetails.title}_${quality}.mp4`,
            mimetype: 'video/mp4',
            caption: `🎬 *${movieDetails.title}*\n🎥 Quality: ${quality}\n👤 Requested by: ${requesterName}`
        });

        // Step 4: Immediately Delete file from VPS/Server disk
        await fs.remove(filePath);
        console.log(`✓ Deleted local file: ${filePath}`);

        // Step 5: Send Success Message
        await sock.sendMessage(targetJid, {
            text: `✅ *${requesterName}*, your requested movie "${movieDetails.title}" is uploaded!\n\n🍿 Enjoy watching!`
        });

    } catch (error) {
        console.error('Error processing request:', error);
        await sock.sendMessage(targetJid, {
            text: `❌ Error processing "${movieName}" for *${requesterName}*:\n${error.message}`
        });
    }
}

/**
 * Process queue one item at a time
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

    // Process next item in queue
    if (requestQueue.length > 0) {
        setTimeout(() => processQueue(sock), 1500);
    }
}

/**
 * Parses incoming WhatsApp text for FilmFeed movie request
 */
function parseMovieRequest(message) {
    // Expected formats:
    // "FilmFeed Request: Avatar | Quality: 720p | Token: abc123xyz"
    // "Avatar | 720p | abc123xyz"

    let cleanMsg = message.replace(/^FilmFeed Request:\s*/i, '').trim();
    const parts = cleanMsg.split('|').map(p => p.trim());

    if (parts.length >= 2) {
        let movieName = parts[0];
        let quality = parts[1].replace(/Quality:\s*/i, '').trim();
        let token = parts[2] ? parts[2].replace(/Token:\s*/i, '').trim() : '';

        if (movieName && quality) {
            return { movieName, quality, token };
        }
    }

    return null;
}

/**
 * Start Baileys WhatsApp Bot
 */
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['FilmFeed Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('--- SCAN WHATSAPP QR CODE ---');
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
            console.log('✓ Group JID:', GROUP_JID);
            console.log('==========================================');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const messageText = msg.message.conversation ||
                          msg.message.extendedTextMessage?.text || '';

        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || 'Member';

        const request = parseMovieRequest(messageText);

        if (request) {
            // Track request count for this user
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
console.log('🤖 Starting FilmFeed WhatsApp Bot...');
startBot().catch(console.error);
