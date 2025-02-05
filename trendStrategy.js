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

  console.log(
    `📊 EMA50: ${ema50.length}, EMA200: ${ema200.length}, RSI: ${rsi.length}, MACD: ${macd.length}, ADX: ${adx.length}`
  );
  return { ema50, ema200, rsi, macd, adx };
}

function generateTrendSignal(candles) {
  const { ema50, ema200, rsi, macd, adx } = calculateIndicators(candles);

  // ✅ If any indicator is missing, we skip
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
  const lastADX = adx[adx.length - 1];

  // ✅ Ensuring lastMACD is valid before accessing properties
  if (!lastMACD || !prevMACD) {
    console.warn(`⚠️ MACD data incomplete, skipping trade decision.`);
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

  const macdBearish = lastMACD.MACD < 0; // Ensure MACD is negative for shorts

  const strongTrend = lastADX > 20; // ADX > 20 means market is trending

  // ✅ **BUY Conditions (More Opportunities)**
  if (
    (emaCrossoverUp || macdCrossoverUp) &&
    lastRSI > 35 && // 🔹 Loosened RSI lower bound for more entries
    lastRSI < 75 && // 🔹 Loosened RSI upper bound slightly
    strongTrend
  ) {
    return "BUY";
  }

  // ✅ **SELL Conditions (Better Shorts)**
  if (
    (emaCrossoverDown || macdCrossoverDown || macdBearish) &&
    lastRSI < 55 && // 🔹 Loosened RSI upper bound for shorts
    strongTrend
  ) {
    return "SELL";
  }

  return "HOLD";
}

module.exports = { generateTrendSignal };
