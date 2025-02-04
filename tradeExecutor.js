const ccxt = require('ccxt');
const { exchange, apiKey, secret } = require('./config');

const exchangeInstance = new ccxt.bybit({
    apiKey: apiKey,
    secret: secret,
    enableRateLimit: true
});

const tradeHistory = [];

async function executeTrade(symbol, side, usdAmount) {
    try {
        const ticker = await exchangeInstance.fetchTicker(symbol);
        const price = ticker.last;
        const amount = usdAmount / price;

        const stopLoss = side === 'buy' ? price * 0.98 : price * 1.02; // 2% SL
        const takeProfit = side === 'buy' ? price * 1.05 : price * 0.95; // 5% TP

        const order = await exchangeInstance.createMarketOrder(symbol, side, amount);
        
        await exchangeInstance.createOrder(symbol, 'stop_market', side === 'buy' ? 'sell' : 'buy', amount, stopLoss, { stopPrice: stopLoss });
        await exchangeInstance.createOrder(symbol, 'take_profit_market', side === 'buy' ? 'sell' : 'buy', amount, takeProfit, { stopPrice: takeProfit });

        tradeHistory.push({ symbol, side, amount, price, stopLoss, takeProfit, timestamp: Date.now() });

        console.log(`✅ Trade executed: ${side} ${amount.toFixed(6)} ${symbol} @ ${price.toFixed(2)} USD`);
        console.log(`🎯 SL: ${stopLoss.toFixed(2)} | TP: ${takeProfit.toFixed(2)}`);
    } catch (err) {
        console.error(`❌ Trade Execution Error:`, err.message);
    }
}

module.exports = { executeTrade, tradeHistory };
