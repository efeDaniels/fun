const { EMA, RSI, MACD } = require('technicalindicators');

function calculateIndicators(candles) {
    const closes = candles.map(c => c.close);
    
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const ema200 = EMA.calculate({ period: 200, values: closes });
    const rsi = RSI.calculate({ period: 14, values: closes });
    const macd = MACD.calculate({
        values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false
    });

    return { ema50, ema200, rsi, macd };
}

function generateTrendSignal(candles) {
    const { ema50, ema200, rsi, macd } = calculateIndicators(candles);
    
    const lastEMA50 = ema50[ema50.length - 1];
    const lastEMA200 = ema200[ema200.length - 1];
    const lastMACD = macd[macd.length - 1];
    const lastRSI = rsi[rsi.length - 1];

    if (lastEMA50 > lastEMA200 && lastMACD.histogram > 0 && lastRSI < 70) {
        return 'BUY';
    } else if (lastEMA50 < lastEMA200 && lastMACD.histogram < 0 && lastRSI > 30) {
        return 'SELL';
    }
    return 'HOLD';
}

module.exports = { generateTrendSignal };