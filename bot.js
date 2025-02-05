const ccxt = require("ccxt");
const { generateTrendSignal, calculateIndicators } = require("./trendStrategy");
const {
  executeTrade,
  monitorPositions,
  getOpenPositions,
  MAX_OPEN_POSITIONS,
} = require("./tradeExecutor"); // ✅ Import getOpenPositions
require("dotenv").config();

// Exchange setup with rate limiting
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
  options: {
    adjustForTimeDifference: true,
  },
});

const PAIR_BATCH_SIZE = 50;
const MAX_PAIRS_TO_ANALYZE = 150;
const REQUEST_DELAY_MS = 200;

let shouldAnalyzeMarket = true; // ✅ Flag to enable/disable market analysis

/**
 * Check if the number of open positions is at the threshold
 */
async function checkPositionThreshold() {
  const openPositions = await getOpenPositions();

  if (openPositions.length >= MAX_OPEN_POSITIONS) {
    if (shouldAnalyzeMarket) {
      console.log(
        `⚠️ Max positions reached (${MAX_OPEN_POSITIONS}). Pausing market analysis.`
      );
    }
    shouldAnalyzeMarket = false;
  } else {
    if (!shouldAnalyzeMarket) {
      console.log(`✅ Position closed! Resuming market analysis.`);
    }
    shouldAnalyzeMarket = true;
  }
}

/**
 * Fetch USDT balance and return fixed trade amount
 */
async function getTradeAmount() {
  return 20;
}

/**
 * Fetch top USDT trading pairs based on volume and apply throttling
 */
async function getTopTradingPairs() {
  try {
    const markets = await exchangeInstance.loadMarkets();
    const usdtPairs = Object.keys(markets).filter((pair) =>
      pair.endsWith("/USDT:USDT")
    );

    console.log(
      `🔍 Found ${usdtPairs.length} USDT pairs. Fetching volume data...`
    );

    const volumeData = [];
    for (const pair of usdtPairs) {
      try {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));

        const ticker = await exchangeInstance.fetchTicker(pair);
        const baseVolume =
          ticker.baseVolume || parseFloat(ticker.info?.volume24h) || 0;
        const quoteVolume =
          ticker.quoteVolume || parseFloat(ticker.info?.turnover24h) || 0;
        const selectedVolume = quoteVolume;

        volumeData.push({ pair, volume: selectedVolume });
      } catch (err) {
        console.warn(`⚠️ Skipping ${pair} due to error: ${err.message}`);
      }
    }

    const validPairs = volumeData.filter((data) => data.volume > 10_000);
    if (validPairs.length < 50) {
      console.warn(`⚠️ Only ${validPairs.length} pairs meet volume criteria.`);
    }

    const shuffledPairs = validPairs.sort(() => 0.5 - Math.random());
    const selectedPairs = shuffledPairs.slice(0, 50).map((data) => data.pair);

    console.log(`✅ Selected ${selectedPairs.length} Pairs for Trading.`);
    return selectedPairs;
  } catch (err) {
    console.error("❌ Error fetching trading pairs:", err.message);
    return [];
  }
}

/**
 * Fetch OHLCV (candlestick) data for a given symbol
 */
async function fetchCandles(symbol) {
  try {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));

    const ohlcv = await exchangeInstance.fetchOHLCV(
      symbol,
      "30m",
      undefined,
      250
    );

    if (!ohlcv || ohlcv.length < 200) {
      console.warn(
        `⚠️ Not enough candles fetched for ${symbol}. Received: ${
          ohlcv?.length || 0
        }.`
      );
      return [];
    }

    console.log(`📊 ${symbol}: Successfully fetched ${ohlcv.length} candles.`);
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
 * Find the best trading pair based on signals, volume, and spread
 */
async function findBestTradingPair() {
  if (!shouldAnalyzeMarket) {
    console.log("🛑 Market analysis paused due to max open positions.");
    return null;
  }

  const pairs = await getTopTradingPairs();
  if (pairs.length === 0) return null;

  let bestPair = null;
  let bestScore = null;

  for (
    let i = 0;
    i < Math.min(pairs.length, MAX_PAIRS_TO_ANALYZE);
    i += PAIR_BATCH_SIZE
  ) {
    const batch = pairs.slice(i, i + PAIR_BATCH_SIZE);
    console.log(`🔍 Analyzing batch ${Math.floor(i / PAIR_BATCH_SIZE) + 1}...`);

    const results = await Promise.all(
      batch.map(async (pair) => {
        try {
          console.log(`🔍 Analyzing ${pair}...`);

          await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
          const ticker = await exchangeInstance.fetchTicker(pair);
          if (!ticker || !ticker.last) return null;

          const volume = ticker.quoteVolume || ticker.baseVolume || 0;
          const spread = ticker.ask - ticker.bid;
          if (volume < 10_000 || spread > 0.5) return null;

          const candles = await fetchCandles(pair);
          if (!candles.length) return null;

          const signal = generateTrendSignal(candles);
          if (!signal) return null;

          let score = 0;
          let reasoning = [];

          if (signal === "BUY") {
            score += 3;
            reasoning.push("🔹 Buy signal detected (+3)");
          } else if (signal === "SELL") {
            score -= 3;
            reasoning.push("🔹 Sell signal detected (-3)");
          }

          if (spread < 0.2) score += 1;
          if (volume > 40_000) score += signal === "BUY" ? 2 : -2;

          console.log(`📝 ${pair} Score: ${score}`);
          return { pair, score, candles };
        } catch (err) {
          console.warn(`⚠️ Skipping ${pair} due to error: ${err.message}`);
          return null;
        }
      })
    );

    const validResults = results.filter((res) => res !== null);
    for (const result of validResults) {
      const { pair, score, candles } = result;
      if (
        bestScore === null ||
        (score > bestScore && bestScore >= 0) ||
        (score < bestScore && bestScore < 0)
      ) {
        bestScore = score;
        bestPair = { pair, candles };
      }
    }

    if (bestPair) break;
  }

  if (bestPair) {
    console.log(
      `✅ Best Pair Selected: ${bestPair.pair} (Score: ${bestScore})`
    );
    return {
      bestPair: bestPair.pair,
      bestCandles: bestPair.candles,
      bestScore,
    };
  } else {
    console.log("⚠️ No suitable trading pair found.");
    return null;
  }
}

/**
 * Main trading function that runs periodically
 */
async function startTrading() {
  console.log(`🚀 Starting Trading Bot...`);

  setInterval(async () => {
    await monitorPositions();
    await checkPositionThreshold();

    if (!shouldAnalyzeMarket) {
      console.log("🛑 Market analysis paused. Monitoring only...");
      return;
    }

    const tradeData = await findBestTradingPair();
    if (!tradeData) {
      console.log("ℹ️ No suitable trading pair found. Retrying...");
      return;
    }

    const { bestPair, bestCandles, bestScore } = tradeData;
    console.log(`✅ 👉 Best Pair: ${bestPair}`);

    if (bestScore > -2 && bestScore < 2) {
      console.log(
        `⚠️ Best pair score (${bestScore}) is too low. Skipping trade.`
      );
      return;
    }

    const tradeAmount = await getTradeAmount();
    if (tradeAmount === 0) return;

    const signal = generateTrendSignal(bestCandles);
    console.log(`📢 Trade Signal for ${bestPair}: ${signal}`);

    if (signal === "BUY") {
      await executeTrade(bestPair, "buy", tradeAmount);
    } else if (signal === "SELL") {
      await executeTrade(bestPair, "sell", tradeAmount);
    }
  }, 60000);
}

startTrading();
