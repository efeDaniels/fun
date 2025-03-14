const ccxt = require("ccxt");
const { generateTrendSignal, calculateIndicators } = require("./trendStrategy");
const {
  executeTrade,
  monitorPositions,
  getOpenPositions,
  RISK_CONFIG,
} = require("./tradeExecutor");
const { getSupportResistanceLevels } = require("./support_resistance");
const fs = require('fs');
const path = require('path');
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

const rateLimiter = {
  lastCall: 0,
  minInterval: REQUEST_DELAY_MS,
  async throttle() {
    const now = Date.now();
    const timeToWait = this.lastCall + this.minInterval - now;
    if (timeToWait > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }
    this.lastCall = Date.now();
  },
};

// Define trusted pairs for trading
const TRUSTED_PAIRS = [
  "ETH/USDT:USDT",
  "SOL/USDT:USDT",
  "BNB/USDT:USDT",
  "XRP/USDT:USDT",
  "AVAX/USDT:USDT",
  "MATIC/USDT:USDT",
  "LINK/USDT:USDT",
  "DOT/USDT:USDT",
  "ADA/USDT:USDT",
  "ATOM/USDT:USDT",
  "UNI/USDT:USDT",
  "AAVE/USDT:USDT",
  "ARB/USDT:USDT",
  "OP/USDT:USDT",
  "PEPE/USDT:USDT",
  "DOGE/USDT:USDT",
  "SHIB/USDT:USDT",
  "STX/USDT:USDT",
  "FIL/USDT:USDT",
  "RUNE/USDT:USDT",
  "INJ/USDT:USDT",
  "NEAR/USDT:USDT",
  "SEI/USDT:USDT",
  "SUI/USDT:USDT",
  "APT/USDT:USDT",
  "JTO/USDT:USDT",
  "PYTH/USDT:USDT",
  "LDO/USDT:USDT",
];

const BLACKLISTED_PAIRS = [
  "BTC/USDT:USDT", //Min Trade Amount is too high for BTC so excluding it from the list at testing phrase.
];

// Add at the top with other constants
const STATS_FILE = path.join(__dirname, 'trade_stats.json');

// Load existing stats on startup
const tradeStats = (() => {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch (err) {
    // Return default stats if file doesn't exist
    return {
      successful: 0,
      failed: 0,
      totalProfit: 0,
      closedTrades: []
    };
  }
})();

// Function to save stats
function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(tradeStats, null, 2));
  } catch (err) {
    console.error('❌ Error saving trade stats:', err);
  }
}

/**
 * Check if the number of open positions is at the threshold
 */
async function checkPositionThreshold() {
  const openPositions = await getOpenPositions();

  if (openPositions.length >= RISK_CONFIG.maxPositions) {
    if (shouldAnalyzeMarket) {
      console.log(
        `⚠️ Max positions reached (${RISK_CONFIG.maxPositions}). Pausing market analysis.`
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
    // Get current open positions first
    const openPositions = await getOpenPositions();
    
    // Check if we've hit max positions and return early if so
    if (openPositions.length >= RISK_CONFIG.maxPositions) {
      console.log(`⚠️ Max positions (${RISK_CONFIG.maxPositions}) reached. Market analysis paused.`);
      return [];
    }

    const markets = await exchangeInstance.loadMarkets();
    const openPositionPairs = new Set(openPositions.map((pos) => pos.symbol));

    // Filter out blacklisted pairs and pairs we already have positions in
    const availablePairs = TRUSTED_PAIRS.filter(
      (pair) =>
        pair in markets &&
        !openPositionPairs.has(pair) &&
        !BLACKLISTED_PAIRS.includes(pair)
    );

    console.log(
      `🔍 Analyzing ${availablePairs.length} available pairs (${openPositionPairs.size} pairs excluded due to open positions)...`
    );

    const volumeData = [];
    for (const pair of availablePairs) {
      try {
        await rateLimiter.throttle();
        const ticker = await exchangeInstance.fetchTicker(pair);
        const quoteVolume =
          ticker.quoteVolume || parseFloat(ticker.info?.turnover24h) || 0;

        volumeData.push({
          pair,
          volume: quoteVolume,
          price: ticker.last,
          spread: ticker.ask - ticker.bid,
        });
      } catch (err) {
        console.warn(`⚠️ Skipping ${pair} due to error: ${err.message}`);
      }
    }

    // Stricter volume and spread filters for major pairs
    const validPairs = volumeData.filter(
      (data) =>
        data.volume > 50_000 && // Higher min volume
        data.spread / data.price < 0.001 // Max 0.1% spread
    );

    console.log(`✅ Found ${validPairs.length} pairs meeting criteria`);
    return validPairs.map((data) => data.pair);
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
    await rateLimiter.throttle();

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

    console.log(`
│ 📊 ${symbol}: Successfully fetched ${ohlcv.length} candles
`);
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
 * Check market health
 */
async function checkMarketHealth(candles) {
  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];

  // Calculate volatility
  const volatility =
    candles.reduce(
      (sum, candle) => sum + Math.abs(candle.high - candle.low) / candle.low,
      0
    ) / candles.length;

  // Calculate trend strength
  const trendStrength =
    Math.abs(lastCandle.close - firstCandle.close) / firstCandle.close;

  return {
    isHealthy: volatility < 0.03 && trendStrength < 0.15,
    volatility,
    trendStrength,
  };
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

  let allResults = [];

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

          await rateLimiter.throttle();
          const ticker = await exchangeInstance.fetchTicker(pair);
          if (!ticker || !ticker.last) return null;

          const volume = ticker.quoteVolume || ticker.baseVolume || 0;
          const spread = ticker.ask - ticker.bid;
          const currentPrice = ticker.last;
          let reasoning = [];

          if (volume < 10_000) return null;
          if (spread > 0.5) return null;

          const candles = await fetchCandles(pair);
          if (!candles.length) return null;

          // Get technical analysis data
          const analysis = generateTrendSignal(candles);
          if (!analysis.indicators) return null;

          let score = analysis.technicalScore.score;
          reasoning = [...analysis.technicalScore.reasons];

          // Volume scoring based on discrete bands
          const volumeBands = [
            { min: 100_000, max: 500_000, points: 1, label: "Decent" },
            { min: 500_000, max: 2_000_000, points: 2, label: "High" },
            { min: 2_000_000, max: 5_000_000, points: 3, label: "Very High" },
            { min: 5_000_000, max: Infinity, points: 4, label: "Exceptional" },
          ];

          let volumeScore = 0;
          for (const band of volumeBands) {
            if (volume >= band.min && volume < band.max) {
              volumeScore = band.points;
              if (score > 0) {
                score += volumeScore;
                reasoning.push(
                  `${band.label} volume supports LONG +${volumeScore}`
                );
              } else if (score < 0) {
                score -= volumeScore; // Makes score more negative for shorts
                reasoning.push(
                  `${band.label} volume strengthens SHORT -${volumeScore}`
                );
              }
              break;
            }
          }

          // Spread score
          if (spread < 0.2) {
            if (score > 0) {
              score += 1;
              reasoning.push("Low spread benefits LONG (+1)");
            } else if (score < 0) {
              score -= 1;
              reasoning.push("❌ Low spread weakens SHORT (-1)");
            }
          }
          // Get S/R levels
          const srLevels = await getSupportResistanceLevels(pair, "4h");

          let nearestSupport = srLevels.support
            .filter((s) => s.price < currentPrice)
            .sort((a, b) => b.price - a.price)[0];

          let nearestResistance = srLevels.resistance
            .filter((r) => r.price > currentPrice)
            .sort((a, b) => a.price - b.price)[0];

          // Score based on proximity to S/R
          if (nearestSupport) {
            const supportDistance =
              (currentPrice - nearestSupport.price) / currentPrice;

            // Fiyata yakınlık değerine göre katsayı belirle (ne kadar yakınsa o kadar etkili)
            let proximityFactor = 0;

            if (supportDistance < 0.005) {
              // %0.5'ten yakın
              proximityFactor = 1; // Tam etki
            } else if (supportDistance < 0.01) {
              // %1'den yakın
              proximityFactor = 0.8; // %80 etki
            } else if (supportDistance < 0.02) {
              // %2'den yakın
              proximityFactor = 0.5; // %50 etki
            }

            if (proximityFactor > 0 && score > 0) {
              const normalizedStrength = Math.min(
                nearestSupport.strength || 3,
                2
              ); // Maksimum 2 puan

              const pointsToAdd = normalizedStrength * proximityFactor;

              score += pointsToAdd;
              reasoning.push(
                `Near support (${(supportDistance * 100).toFixed(
                  1
                )}% away): Strengthening LONG signal by +${pointsToAdd.toFixed(
                  1
                )} points`
              );
            }
          }

          if (nearestResistance) {
            const resistanceDistance =
              (nearestResistance.price - currentPrice) / currentPrice;

            // Fiyata yakınlık değerine göre katsayı belirle
            let proximityFactor = 0;

            if (resistanceDistance < 0.005) {
              // %0.5'ten yakın
              proximityFactor = 1; // Tam etki
            } else if (resistanceDistance < 0.01) {
              // %1'den yakın
              proximityFactor = 0.8; // %80 etki
            } else if (resistanceDistance < 0.02) {
              // %2'den yakın
              proximityFactor = 0.5; // %50 etki
            }

            if (proximityFactor > 0 && score < 0) {
              // Strength değerini normalize et ve etkisini sınırla
              const normalizedStrength = Math.min(
                nearestResistance.strength || 3,
                2
              ); // Maksimum 2 puan

              // Eklenecek puanı hesapla (negatif değerler için)
              const pointsToSubtract = normalizedStrength * proximityFactor;

              score -= pointsToSubtract;
              reasoning.push(
                `Near resistance (${(resistanceDistance * 100).toFixed(
                  1
                )}% away): Strengthening SHORT signal by ${pointsToSubtract.toFixed(
                  1
                )} points`
              );
            }
          }

          // Final score adjustments
          if (nearestSupport && nearestResistance) {
            const range =
              Math.abs(nearestResistance.price - nearestSupport.price) /
              currentPrice;
            if (
              range < 0.02 &&
              nearestSupport.strength >= 3 &&
              nearestResistance.strength >= 3
            ) {
              score *= 0.5;
              reasoning.push("Choppy market between S/R (Score halved)");
            }
          }

          console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║ ${pair}                                                                     
║ Final Score: ${score.toFixed(2)}                                           
║ Reasoning: ${reasoning.join(" | ")}                                        
╚════════════════════════════════════════════════════════════════════════════╝
`);
          return {
            pair,
            score,
            candles,
            reasoning,
            indicators: analysis.indicators,
          };
        } catch (err) {
          console.warn(`⚠️ Skipping ${pair} due to error: ${err.message}`);
          return null;
        }
      })
    );

    allResults.push(...results.filter((res) => res !== null));
  }

  if (allResults.length > 0) {
    let bestTrade = allResults[0];

    for (const trade of allResults) {
      // Compare absolute values of scores to find strongest signal
      if (Math.abs(trade.score) > Math.abs(bestTrade.score)) {
        bestTrade = trade;
      }
    }

    console.log(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🎉 Best Pair Selected: ${bestTrade.pair} 
┃ Score: ${bestTrade.score} | ${bestTrade.score > 0 ? '📈 LONG' : '📉 SHORT'}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
`);
    return {
      bestPair: bestTrade.pair,
      bestCandles: bestTrade.candles,
      bestScore: bestTrade.score,
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

  // Monitor positions every 100 seconds
  setInterval(async () => {
    try {
      await monitorPositions();
    } catch (err) {
      console.error("❌ Error monitoring positions:", err);
    }
  }, 100000); // Every 100 seconds

  // Trading analysis loop
  setInterval(async () => {
    try {
      shouldAnalyzeMarket = true;

      // Rest of the trading logic...
      const tradeData = await findBestTradingPair();
      if (!tradeData) return;

      const { bestPair, bestCandles, bestScore } = tradeData;
      console.log(`✅ 👉 Best Pair: ${bestPair} (Score: ${bestScore})`);

      const tradeAmount = await getTradeAmount();
      if (tradeAmount === 0) return;

      // One final position check before trade
      const openPositions = await getOpenPositions();
      if (openPositions.length >= RISK_CONFIG.maxPositions) {
        console.log(`⚠️ Max positions reached during analysis, skipping trade`);
        return;
      }

      if (bestScore > 10) {
        // For longs: score must be HIGHER than 10
        console.log("🚀 Strong LONG signal detected");
        await executeTrade(bestPair, "buy", tradeAmount, bestScore);
        tradeStats.successful++;
        tradeStats.totalProfit += bestScore;
      } else if (bestScore < -10) {
        // For shorts: score must be LOWER than -10
        console.log("🚀 Strong SHORT signal detected");
        await executeTrade(bestPair, "sell", tradeAmount, bestScore);
        tradeStats.failed++;
        tradeStats.totalProfit -= bestScore;
      }

      // Save after updating stats
      saveStats();
    } catch (err) {
      console.error("❌ Error in trading loop:", err);
    }
  }, 60000); // Every minute

  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
    setTimeout(() => {
      console.log("Attempting recovery...");
      startTrading();
    }, 60000);
  });

  // Fixed performance logging
  setInterval(() => {
    const totalTrades = tradeStats.successful + tradeStats.failed;
    const winRate = totalTrades > 0 ? (tradeStats.successful / totalTrades * 100) : 0;
    
    // Get last 24h performance
    const last24h = tradeStats.closedTrades.filter(t => 
      t.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );
    const profit24h = last24h.reduce((sum, t) => sum + t.profit, 0);

    console.log(`
╭─────────── 📊 Performance Report ───────────╮
│ Total Trades: ${totalTrades}
│ Successful: ${tradeStats.successful}
│ Failed: ${tradeStats.failed}
│ Win Rate: ${winRate.toFixed(2)}%
│ Total Profit: $${tradeStats.totalProfit.toFixed(2)}
│ 24h Profit: $${profit24h.toFixed(2)}
│ Last Trade: ${tradeStats.closedTrades[tradeStats.closedTrades.length - 1]?.symbol || 'None'}
╰───────────────────────────────────────────╯
    `);
  }, 3600000); // Every hour

  // Also save periodically as backup
  setInterval(saveStats, 300000); // Every 5 minutes
}

startTrading();
