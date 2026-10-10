const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Configuration for GitHub Actions
const GROUP_JID = process.env.GROUP_JID || '120363354181677834@g.us';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Queue system
const requestQueue = [];
let isProcessing = false;

// Ensure download directory exists
fs.ensureDirSync(DOWNLOAD_DIR);

async function downloadMovie(url, filename) {
    const filePath = path.join(DOWNLOAD_DIR, filename);
    
    try {
        console.log(`Downloading: ${filename}`);
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 600000,
            maxRedirects: 5
        });

        const totalSize = parseInt(response.headers['content-length'], 10);
        
        if (totalSize > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds 2GB limit`);
        }

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✓ Downloaded: ${filename}`);
                resolve({ filePath, size: totalSize });
            });
            writer.on('error', reject);
        });
    } catch (error) {
        throw error;
    }
}

async function searchMovieWithScraper(movieName) {
    try {
        const { exec } = require('child_process');
        const scraperScript = path.join(__dirname, '..', 'scrape_movies.py');
        
        return new Promise((resolve, reject) => {
            exec(`python "${scraperScript}" "${movieName}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Scraper error:', stderr);
                    reject(error);
                    return;
                }
                
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (e) {
                    console.error('Failed to parse scraper output');
                    reject(e);
                }
            });
        });
    } catch (error) {
        console.error('Scraper error:', error);
        return null;
    }
}

async function processRequest(sock, request) {
    const { chatId, movieName, quality, token, requesterName } = request;
    
    try {
        await sock.sendMessage(GROUP_JID, {
            text: `🎬 Processing request from *${requesterName}*\nMovie: ${movieName}\nQuality: ${quality}\n\n⏳ Searching...`
        });

        const movieDetails = await searchMovieWithScraper(movieName);
        
        if (!movieDetails || !movieDetails.downloadUrl) {
            await sock.sendMessage(GROUP_JID, {
                text: `❌ Sorry *${requesterName}*, couldn't find "${movieName}"`
            });
            return;
        }

        let detailsMsg = `🎬 *${movieDetails.title}*\n\n`;
        detailsMsg += `📝 ${movieDetails.description || 'No description'}\n\n`;
        detailsMsg += `🎥 Quality: ${quality}\n`;
        detailsMsg += `👤 Requested by: ${requesterName}\n\n`;
        detailsMsg += `⬇️ Downloading...`;

        if (movieDetails.poster) {
            await sock.sendMessage(GROUP_JID, {
                image: { url: movieDetails.poster },
                caption: detailsMsg
            });
        } else {
            await sock.sendMessage(GROUP_JID, { text: detailsMsg });
        }

        const filename = `${movieName.replace(/[^a-z0-9]/gi, '_')}_${quality}.mp4`;
        const { filePath, size } = await downloadMovie(movieDetails.downloadUrl, filename);

        if (size > MAX_FILE_SIZE) {
            await sock.sendMessage(GROUP_JID, {
                text: `⚠️ *${requesterName}*, file is ${(size / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n` +
                      `WhatsApp limit is 2GB.\n\n` +
                      `Direct link: ${movieDetails.downloadUrl}`
            });
            
            await fs.remove(filePath);
            return;
        }

        await sock.sendMessage(GROUP_JID, {
            text: `📤 Uploading "${movieName}"...`
        });

        await sock.sendMessage(GROUP_JID, {
            document: { url: filePath },
            fileName: filename,
            mimetype: 'video/mp4',
            caption: `🎬 *${movieName}*\n🎥 ${quality}\n👤 ${requesterName}`
        });

        await fs.remove(filePath);
        console.log(`✓ Deleted: ${filename}`);

        await sock.sendMessage(GROUP_JID, {
            text: `✅ *${requesterName}*, your movie is ready! 🍿`
        });

    } catch (error) {
        console.error('Error processing request:', error);
        
        await sock.sendMessage(GROUP_JID, {
            text: `❌ Error: ${error.message}\n\nPlease try again later.`
        });
    }
}

async function processQueue(sock) {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const request = requestQueue.shift();

    try {
        await processRequest(sock, request);
    } catch (error) {
        console.error('Queue processing error:', error);
    }

    isProcessing = false;

    if (requestQueue.length > 0) {
        setTimeout(() => processQueue(sock), 1000);
    }
}

function parseMovieRequest(message) {
    const parts = message.split('|').map(p => p.trim());
    
    if (parts.length >= 3) {
        return {
            movieName: parts[0],
            quality: parts[1],
            token: parts[2]
        };
    }
    
    return null;
}

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
            console.log('QR Code generated');
            console.log('Scan with WhatsApp to connect');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                setTimeout(startBot, 3000);
            } else {
                console.log('Logged out. Please scan QR again');
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('✓ Bot connected!');
            console.log('✓ Listening for movie requests...');
            console.log('✓ Group JID:', GROUP_JID);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        if (!msg.message || msg.key.fromMe) return;

        const messageText = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || '';
        
        const chatId = msg.key.remoteJid;
        const pushName = msg.pushName || 'User';

        console.log(`Message from ${pushName}: ${messageText}`);

        const request = parseMovieRequest(messageText);
        
        if (request) {
            requestQueue.push({
                chatId,
                ...request,
                requesterName: pushName
            });

            const position = requestQueue.length;

            if (position === 1 && !isProcessing) {
                await sock.sendMessage(chatId, {
                    text: `✅ Processing now!\n\n🎬 ${request.movieName}\n🎥 ${request.quality}`
                });
                
                processQueue(sock);
            } else {
                await sock.sendMessage(chatId, {
                    text: `✅ Added to queue!\n\n🎬 ${request.movieName}\n📊 Position: ${position}`
                });
            }
        }
    });

    // Keep alive
    setInterval(() => {
        console.log('Bot alive at:', new Date().toISOString());
    }, 300000); // Every 5 minutes
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('Bot stopping...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot stopping...');
    process.exit(0);
});

// Start
console.log('🤖 FilmFeed Bot Starting...');
console.log('📱 Environment: GitHub Actions');
console.log('🔗 Group JID:', GROUP_JID);

startBot().catch(console.error);
