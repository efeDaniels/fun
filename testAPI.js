const ccxt = require('ccxt');
require('dotenv').config();

async function testConnection() {
    const exchange = new ccxt.bybit({
        apiKey: process.env.API_KEY,
        secret: process.env.API_SECRET,
        enableRateLimit: true
    });

    try {
        const balance = await exchange.fetchBalance();
        console.log('✅ API Connection Successful! USDT Balance:', balance.USDT.free);
    } catch (err) {
        console.error('❌ API Connection Failed:', err.message);
    }
}

testConnection();
