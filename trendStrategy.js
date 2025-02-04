const { EMA, RSI, MACD, ADX } = require("technicalindicators");

function calculateIndicators(candles) {
  const closes = candles.map((c) => c.close);

  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const rsi = RSI.calculate({ period: 14, values: closes });
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
  });
  const adx = ADX.calculate({
    close: closes,
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    period: 14,
  });

  return { ema50, ema200, rsi, macd, adx };
}

function generateTrendSignal(candles) {
  const { ema50, ema200, rsi, macd, adx } = calculateIndicators(candles);

  const lastEMA50 = ema50[ema50.length - 1];
  const lastEMA200 = ema200[ema200.length - 1];
  const lastMACD = macd[macd.length - 1];
  const prevMACD = macd[macd.length - 2]; // Previous MACD for crossover check
  const lastRSI = rsi[rsi.length - 1];
  const lastADX = adx[adx.length - 1]?.adx || 0; // ADX Strength Check

  // ✅ **Better Trend Confirmation**
  const emaCrossoverUp =
    lastEMA50 > lastEMA200 &&
    ema50[ema50.length - 2] < ema200[ema200.length - 2];
  const emaCrossoverDown =
    lastEMA50 < lastEMA200 &&
    ema50[ema50.length - 2] > ema200[ema200.length - 2];

  // ✅ **Stronger MACD Crossovers**
  const macdCrossoverUp =
    lastMACD.MACD > lastMACD.signal && prevMACD.MACD < prevMACD.signal;
  const macdCrossoverDown =
    lastMACD.MACD < lastMACD.signal && prevMACD.MACD > prevMACD.signal;
  const macdBearish = lastMACD.MACD < 0; // Ensure MACD is negative for shorts

  // ✅ **ADX Trend Strength Filtering**
  const strongTrend = lastADX > 20; // ADX > 20 means market is trending
  const weakTrend = lastADX < 20; // ADX < 20 means market is choppy

  // ✅ **BUY Conditions**
  if (
    (emaCrossoverUp || macdCrossoverUp) &&
    lastRSI > 40 &&
    lastRSI < 70 &&
    strongTrend
  ) {
    return "BUY";
  }

  // ✅ **SELL Conditions (Better Shorts)**
  if (
    (emaCrossoverDown || macdCrossoverDown || macdBearish) &&
    lastRSI < 50 &&
    strongTrend
  ) {
    return "SELL";
  }

  return "HOLD";
}

module.exports = { generateTrendSignal };
