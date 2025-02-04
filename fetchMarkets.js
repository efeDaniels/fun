const ccxt = require('ccxt');
require('dotenv').config();

async function fetchMarkets() {
    const exchange = new ccxt.bybit({
        apiKey: process.env.API_KEY,
        secret: process.env.API_SECRET,
        enableRateLimit: true
    });

    try {
        const markets = await exchange.loadMarkets();
        console.log("✅ Available Pairs on Bybit:", Object.keys(markets));
    } catch (err) {
        console.error("❌ Error fetching markets:", err.message);
    }
}

fetchMarkets();
