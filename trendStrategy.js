const { EMA, RSI, MACD, ADX } = require("technicalindicators");

function calculateIndicators(candles) {
  const closes = candles.map((c) => c.close);

  if (closes.length < 200) {
    console.warn(
      `⚠️ Not enough candles for indicator calculation. Need at least 200, got ${closes.length}`
    );
    return { ema50: [], ema200: [], rsi: [], macd: [], adx: [] };
  }

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
    period: 14,
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: closes,
  });

  return { ema50, ema200, rsi, macd, adx };
}

function generateTrendSignal(candles) {
  const { ema50, ema200, rsi, macd, adx } = calculateIndicators(candles);

  if (
    ema50.length === 0 ||
    ema200.length === 0 ||
    rsi.length === 0 ||
    macd.length === 0 ||
    adx.length === 0
  ) {
    console.warn(
      `⚠️ Not enough calculated indicator data. Some indicators are missing values.`
    );
    return "HOLD";
  }

  const lastEMA50 = ema50[ema50.length - 1];
  const lastEMA200 = ema200[ema200.length - 1];
  const lastMACD = macd[macd.length - 1];
  const prevMACD = macd.length > 1 ? macd[macd.length - 2] : lastMACD;
  const lastRSI = rsi[rsi.length - 1];
  const lastADX = adx.length > 0 ? adx[adx.length - 1].adx || 0 : 0;

  if (!lastMACD || !prevMACD || !lastMACD.MACD || !prevMACD.MACD) {
    console.warn(`⚠️ MACD data is incomplete, skipping trade decision.`);
    return "HOLD";
  }

  const emaCrossoverUp =
    lastEMA50 > lastEMA200 &&
    ema50[ema50.length - 2] < ema200[ema200.length - 2];
  const emaCrossoverDown =
    lastEMA50 < lastEMA200 &&
    ema50[ema50.length - 2] > ema200[ema200.length - 2];

  const macdCrossoverUp =
    lastMACD.MACD > lastMACD.signal && prevMACD.MACD < prevMACD.signal;
  const macdCrossoverDown =
    lastMACD.MACD < lastMACD.signal && prevMACD.MACD > prevMACD.signal;

  const macdBullish = lastMACD.MACD > 0; // Ensures MACD is positive for long positions
  const macdBearish = lastMACD.MACD < 0; // Ensures MACD is negative for short positions

  const strongTrend = lastADX >= 15; // 🔹 Lowered from 20 to 15 for more opportunities

  // **BUY Conditions**
  if (
    (emaCrossoverUp || macdCrossoverUp || macdBullish) && // 🔹 Added MACD being bullish
    lastRSI > 25 &&
    lastRSI < 85 && // 🔹 Loosened RSI range
    strongTrend
  ) {
    console.log(`🟢 BUY Signal Triggered!`);
    return "BUY";
  }

  // **SELL Conditions**
  if (
    (emaCrossoverDown || macdCrossoverDown || macdBearish) &&
    lastRSI < 65 &&
    strongTrend
  ) {
    console.log(`🔴 SELL Signal Triggered!`);
    return "SELL";
  }

  console.log(`⚠️ HOLD: No strong trend detected.`);
  return "HOLD";
}

module.exports = { generateTrendSignal, calculateIndicators };
