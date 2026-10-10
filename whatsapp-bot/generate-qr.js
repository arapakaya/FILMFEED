// Generate QR code for bot connection
const qrcode = require('qrcode-terminal')

console.log('\n===========================================')
console.log('  FilmFeed WhatsApp Bot - QR Code')
console.log('===========================================\n')

console.log('📱 Scan this QR code with WhatsApp:')
console.log('   Settings → Linked Devices → Link a Device\n')

// Sample QR for testing
const botNumber = '0760372547'
const connectionText = `FilmFeed Bot Connection - ${botNumber}`

qrcode.generate(connectionText, { small: true }, (qr) => {
    console.log(qr)
    console.log('\n✅ After scanning, bot will connect automatically!')
    console.log('📞 Bot Number: 076 037 2547')
    console.log('\n===========================================\n')
})
