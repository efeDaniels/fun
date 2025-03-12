const ccxt = require("ccxt");

const exchange = new ccxt.bybit({
  enableRateLimit: true,
  options: { adjustForTimeDifference: true },
});

const CANDLE_LIMIT = 100; // Fetch 500 candles for analysis

async function fetchCandles(symbol, timeframe) {
  try {
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, CANDLE_LIMIT);
    if (!ohlcv || ohlcv.length < 100) {
      console.warn(`⚠️ Not enough candles fetched for ${symbol}. Received: ${ohlcv?.length || 0}`);
      return [];
    }
    return ohlcv.map((c) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));
  } catch (err) {
    console.error(`❌ Error fetching candles for ${symbol}:`, err.message);
    return [];
  }
}

function detectSupportResistance(candles) {
  const levels = new Map();
  
  candles.forEach(candle => {
    [candle.high, candle.low].forEach(price => {
      const roundedPrice = Math.round(price * 100) / 100;
      levels.set(roundedPrice, (levels.get(roundedPrice) || 0) + 1);
    });
  });

  function filterLevels(prices) {
    return Array.from(prices)
      .filter(([price, count]) => count >= 3)  // Min 3 touches
      .map(([price]) => price)
      .sort((a, b) => a - b);
  }

  const allPrices = Array.from(levels.entries());
  const supportLevels = allPrices.filter(([price]) => 
    candles.some(c => c.low <= price && c.high >= price));
  const resistanceLevels = allPrices.filter(([price]) => 
    candles.some(c => c.high >= price && c.low <= price));

  return {
    support: filterLevels(supportLevels),
    resistance: filterLevels(resistanceLevels)
  };
}

async function getSupportResistanceLevels(symbol, timeframe = "1h") {
  const candles = await fetchCandles(symbol, timeframe);
  if (!candles.length) return { support: [], resistance: [] };
  
  return detectSupportResistance(candles);
}

// Export for use in trading bot
module.exports = {
  getSupportResistanceLevels
};
