const ccxt = require("ccxt");
const { generateTrendSignal } = require("./trendStrategy");
const { analyzeOrderFlow } = require("./orderFlow");
const {
  executeTrade,
  tradeHistory,
  monitorPositions,
} = require("./tradeExecutor");
const { calculatePnL } = require("./calculatePnL");
require("dotenv").config();

// Exchange setup with rate limiting
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
});

/**
 * Fetch USDT balance and return fixed trade amount
 */
async function getTradeAmount() {
  try {
    const balance = await exchangeInstance.fetchBalance();
    let availableUSDT = balance?.USDT?.free || 0;

    if (availableUSDT < 10) {
      console.log("⚠️ Low balance, skipping trade.");
      return 0;
    }

    let tradeAmount = 10; // Fixed $10 trade amount
    console.log(`💰 Trade Amount: ${tradeAmount} USDT`);
    return tradeAmount;
  } catch (err) {
    console.error("❌ Error fetching balance:", err.message);
    return 0;
  }
}

/**
 * Fetch USDT trading pairs from the exchange
 */
async function getTradingPairs() {
  try {
    const markets = await exchangeInstance.loadMarkets();
    const usdtPairs = Object.keys(markets).filter((pair) =>
      pair.endsWith("/USDT:USDT")
    );

    console.log(`🔍 Found ${usdtPairs.length} USDT pairs.`);
    return usdtPairs;
  } catch (err) {
    console.error("❌ Error fetching trading pairs:", err.message);
    return [];
  }
}

/**
 * Find the best trading pair based on volume, spread, and trend signal
 */
async function findBestTradingPair() {
  const pairs = await getTradingPairs();
  if (pairs.length === 0) {
    console.log("❌ No trading pairs found. Exiting...");
    return null;
  }

  let bestPair = null;
  let bestScore = -Infinity;

  for (let pair of pairs.slice(0, 56)) {
    try {
      console.log(`🔍 Analyzing ${pair}...`);

      // Fetch ticker data
      const ticker = await exchangeInstance.fetchTicker(pair);
      const volume = ticker.quoteVolume || ticker.baseVolume || 0;
      const spread = ticker.ask - ticker.bid;

      console.log(`📊 ${pair} Volume: ${volume}, Spread: ${spread.toFixed(6)}`);

      if (volume < 500_000) continue;
      if (spread > 0.5) continue;

      const candles = await fetchCandles(pair);
      if (!candles.length) continue;

      const signal = generateTrendSignal(candles);
      if (!signal) continue;

      let score = 0;
      if (signal === "BUY") score += 3;
      if (signal === "SELL") score -= 3;
      if (spread < 0.1) score += 1;
      if (volume > 5_000_000) score += 2;

      console.log(`📝 ${pair} Score: ${score}`);

      if (score > bestScore) {
        bestScore = score;
        bestPair = pair;
      }
    } catch (err) {
      console.warn(`⚠️ Skipping ${pair} due to error: ${err.message}`);
    }
  }

  if (bestPair) {
    console.log(`✅ Best Pair Selected: ${bestPair} (Score: ${bestScore})`);
  } else {
    console.log(
      "⚠️ No pair met the criteria. Selecting the highest-volume pair..."
    );
    bestPair = pairs[0];
  }

  return bestPair;
}

/**
 * Fetch OHLCV (candlestick) data for a given symbol
 */
async function fetchCandles(symbol) {
  try {
    const ohlcv = await exchangeInstance.fetchOHLCV(
      symbol,
      "1m",
      undefined,
      100
    );
    return ohlcv.map((c) => ({
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
    }));
  } catch (err) {
    console.error(`❌ Error fetching candles for ${symbol}:`, err.message);
    return [];
  }
}

/**
 * Main trading function that runs periodically
 */
async function startTrading() {
  console.log(`🚀 Starting Trading Bot... Scanning for the best pair...`);

  setInterval(async () => {
    await monitorPositions(); // ✅ Calls `monitorPositions()` from `tradeExecutor.js`

    const bestPair = await findBestTradingPair();
    if (!bestPair) {
      console.log("⚠️ No suitable trading pair found. Retrying...");
      return;
    }

    console.log(`✅ Best Pair: ${bestPair}`);

    const tradeAmount = await getTradeAmount();
    if (tradeAmount === 0) return;

    const candles = await fetchCandles(bestPair);
    const signal = generateTrendSignal(candles);

    console.log(`📢 Trade Signal for ${bestPair}: ${signal}`);

    if (signal === "BUY") {
      console.log(`📢 BUY Signal for ${bestPair}`);
      await executeTrade(bestPair, "buy", tradeAmount); // ✅ Now includes trade amount
    } else if (signal === "SELL") {
      console.log(`📢 SELL Signal for ${bestPair}`);
      await executeTrade(bestPair, "sell", tradeAmount); // ✅ Now includes trade amount
    } else {
      console.log(`🔍 No trade signal for ${bestPair}`);
    }
  }, 60000);
}

startTrading();
