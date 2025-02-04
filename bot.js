const ccxt = require("ccxt");
const { generateTrendSignal } = require("./trendStrategy");
const { analyzeOrderFlow } = require("./orderFlow");
const { executeTrade, tradeHistory } = require("./tradeExecutor");
const { calculatePnL } = require("./calculatePnL");
require("dotenv").config();

// Exchange setup with rate limiting
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
});

/**
 * Fetch USDT balance and return 5% as trade amount
 */
async function getTradeAmount() {
  try {
    const balance = await exchangeInstance.fetchBalance();
    const availableUSDT = balance?.USDT?.free || 0;

    if (availableUSDT < 10) {
      console.log("⚠️ Low balance, skipping trade.");
      return 0;
    }

    return availableUSDT * 0.20; // Use 20% of available balance
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

    return usdtPairs; // Return all USDT pairs
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
    // Scan top 56 pairs
    try {
      console.log(`🔍 Analyzing ${pair}...`);

      // Fetch ticker data
      const ticker = await exchangeInstance.fetchTicker(pair);
      const volume = ticker.quoteVolume || ticker.baseVolume || 0;
      const spread = ticker.ask - ticker.bid;

      console.log(`📊 ${pair} Volume: ${volume}, Spread: ${spread.toFixed(6)}`);

      if (volume < 1_000_000) continue; // Ignore low-volume pairs

      const candles = await fetchCandles(pair);
      if (!candles.length) continue;

      const signal = generateTrendSignal(candles);
      if (!signal) continue;

      // Scoring system
      let score = 0;
      if (signal === "BUY") score += 3;
      if (signal === "SELL") score -= 3;
      if (spread < 0.2) score += 1;
      if (volume > 10_000_000) score += 2;

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
    bestPair = pairs[0]; // Fallback to first pair
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

    if (signal === "BUY") {
      console.log(`📢 BUY Signal for ${bestPair}`);
      await executeTrade(bestPair, "buy", tradeAmount);
    } else if (signal === "SELL") {
      console.log(`📢 SELL Signal for ${bestPair}`);
      await executeTrade(bestPair, "sell", tradeAmount);
    } else {
      console.log(`🔍 No trade signal for ${bestPair}`);
    }

    if (tradeHistory.length % 10 === 0) {
      calculatePnL();
    }
  }, 60000); // Runs every 1 minute
}

startTrading();
