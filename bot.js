const ccxt = require("ccxt");
const { generateTrendSignal } = require("./trendStrategy");
const { analyzeOrderFlow } = require("./orderFlow");
const { executeTrade, monitorPositions } = require("./tradeExecutor");
const { calculatePnL } = require("./calculatePnL");
require("dotenv").config();

// Exchange setup with rate limiting
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
});

const PAIR_BATCH_SIZE = 100; // Optimize by scanning top 100 pairs at a time
const MAX_PAIRS_TO_ANALYZE = 300; // Limit total analysis to avoid rate limiting

/**
 * Fetch USDT balance and return fixed trade amount
 */
async function getTradeAmount() {
  return 10; // Fixed trade amount of $10
}

/**
 * Fetch USDT trading pairs from the exchange
 */
async function getTradingPairs() {
  try {
    const markets = await exchangeInstance.loadMarkets();
    return Object.keys(markets).filter((pair) => pair.endsWith("/USDT:USDT"));
  } catch (err) {
    console.error("❌ Error fetching trading pairs:", err.message);
    return [];
  }
}

/**
 * Find the best trading pair based on volume, spread, trend signal, and order flow
 */
async function findBestTradingPair() {
  const pairs = await getTradingPairs();
  if (pairs.length === 0) return null;

  let bestPair = null;
  let bestScore = -Infinity;

  for (
    let i = 0;
    i < Math.min(pairs.length, MAX_PAIRS_TO_ANALYZE);
    i += PAIR_BATCH_SIZE
  ) {
    const batch = pairs.slice(i, i + PAIR_BATCH_SIZE);
    console.log(`🔍 Analyzing batch ${i / PAIR_BATCH_SIZE + 1}...`);

    for (const pair of batch) {
      try {
        console.log(`🔍 Analyzing ${pair}...`);
        const ticker = await exchangeInstance.fetchTicker(pair);
        if (!ticker || !ticker.last) continue;

        const volume = ticker.quoteVolume || ticker.baseVolume || 0;
        const spread = ticker.ask - ticker.bid;

        if (volume < 500_000 || spread > 0.5) continue;

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
        console.warn(`🛑 Skipping ${pair} due to error: ${err.message}`);
      }
    }

    if (bestPair) break; // Stop searching if a good pair is found
  }

  if (bestPair) {
    console.log(`✅ Best Pair Selected: ${bestPair} (Score: ${bestScore})`);
  } else {
    console.log("⚠️ No suitable trading pair found.");
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
    await monitorPositions();

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

    console.log(`📢📢📢 Trade Signal for ${bestPair}: ${signal} 📢📢📢 `);

    if (signal === "BUY") {
      console.log(`📢🟢📢 BUY Signal for ${bestPair}📢🟢📢`);
      await executeTrade(bestPair, "buy", tradeAmount);
    } else if (signal === "SELL") {
      console.log(`📢💔📢 SELL Signal for ${bestPair} 📢💔📢`);
      await executeTrade(bestPair, "sell", tradeAmount);
    } else {
      console.log(`🔍 No trade signal for ${bestPair}`);
    }
  }, 60000);
}

startTrading();
