const fs = require('fs-extra');
const path = require('path');

const authDir = path.join(__dirname, 'auth_info_baileys');

if (!fs.existsSync(authDir)) {
    console.log('❌ No auth_info_baileys folder found. Please connect bot first.');
    process.exit(1);
}

try {
    const credsPath = path.join(authDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
        const credsData = fs.readFileSync(credsPath, 'utf-8');
        const b64 = Buffer.from(credsData).toString('base64');
        console.log('\n==========================================');
        console.log('✓ WHATSAPP SESSION BASE64 DATA (WA_SESSION_DATA):');
        console.log('==========================================\n');
        console.log(b64);
        console.log('\n==========================================');
        console.log('Copy the text above and save it in GitHub Settings -> Secrets -> WA_SESSION_DATA');
        console.log('==========================================\n');
    } else {
        console.log('❌ creds.json not found inside auth_info_baileys.');
    }
} catch (e) {
    console.error('Error exporting session:', e);
}
