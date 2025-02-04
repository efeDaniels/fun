const { EMA, RSI, MACD } = require("technicalindicators");

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

  return { ema50, ema200, rsi, macd };
}

function generateTrendSignal(candles) {
  const { ema50, ema200, rsi, macd } = calculateIndicators(candles);

  const lastEMA50 = ema50[ema50.length - 1];
  const lastEMA200 = ema200[ema200.length - 1];
  const lastMACD = macd[macd.length - 1];
  const prevMACD = macd[macd.length - 2]; // Previous MACD for crossover check
  const lastRSI = rsi[rsi.length - 1];

  // ✅ More responsive crossover logic
  const emaCrossoverUp =
    lastEMA50 > lastEMA200 &&
    ema50[ema50.length - 2] < ema200[ema200.length - 2];
  const emaCrossoverDown =
    lastEMA50 < lastEMA200 &&
    ema50[ema50.length - 2] > ema200[ema200.length - 2];

  // ✅ MACD crossover
  const macdCrossoverUp =
    lastMACD.MACD > lastMACD.signal && prevMACD.MACD < prevMACD.signal;
  const macdCrossoverDown =
    lastMACD.MACD < lastMACD.signal && prevMACD.MACD > prevMACD.signal;

  // ✅ RSI tweaked thresholds (more frequent trades)
  if ((emaCrossoverUp || macdCrossoverUp) && lastRSI > 40 && lastRSI < 65) {
    return "BUY";
  } else if (
    (emaCrossoverDown || macdCrossoverDown) &&
    lastRSI < 60 &&
    lastRSI > 35
  ) {
    return "SELL";
  }
  return "HOLD";
}

module.exports = { generateTrendSignal };