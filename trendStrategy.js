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
    return { signal: "HOLD", indicators: null, reason: "Insufficient data" };
  }

  const lastEMA50 = ema50[ema50.length - 1];
  const lastEMA200 = ema200[ema200.length - 1];
  const lastMACD = macd[macd.length - 1];
  const prevMACD = macd.length > 1 ? macd[macd.length - 2] : lastMACD;
  const lastRSI = rsi[rsi.length - 1];
  const lastADX = adx[adx.length - 1]?.adx || 0;

  const emaCrossoverUp = lastEMA50 > lastEMA200 && ema50[ema50.length - 2] < ema200[ema200.length - 2];
  const emaCrossoverDown = lastEMA50 < lastEMA200 && ema50[ema50.length - 2] > ema200[ema200.length - 2];
  
  const macdCrossoverUp = lastMACD.MACD > lastMACD.signal && prevMACD.MACD < prevMACD.signal;
  const macdCrossoverDown = lastMACD.MACD < lastMACD.signal && prevMACD.MACD > prevMACD.signal;
  
  const macdBullish = lastMACD.MACD > 0;
  const macdBearish = lastMACD.MACD < 0;
  
  const strongTrend = lastADX >= 20;

  // Return detailed analysis instead of just signal
  return {
    signal: "ANALYZING",
    indicators: {
      ema: {
        crossoverUp: emaCrossoverUp,
        crossoverDown: emaCrossoverDown,
        ema50: lastEMA50,
        ema200: lastEMA200
      },
      macd: {
        crossoverUp: macdCrossoverUp,
        crossoverDown: macdCrossoverDown,
        isBullish: macdBullish,
        isBearish: macdBearish,
        value: lastMACD.MACD,
        signal: lastMACD.signal
      },
      rsi: lastRSI,
      adx: lastADX,
      strongTrend
    },
    technicalScore: calculateTechnicalScore({
      emaCrossoverUp,
      emaCrossoverDown,
      macdCrossoverUp,
      macdCrossoverDown,
      macdBullish,
      macdBearish,
      rsi: lastRSI,
      adx: lastADX
    })
  };
}

function calculateTechnicalScore(indicators) {
  let score = 0;
  let reasons = [];

  // EMA Score
  if (indicators.emaCrossoverUp) {
    score += 2;
    reasons.push("EMA Crossover Up +2");
  } else if (indicators.emaCrossoverDown) {
    score -= 2;
    reasons.push("EMA Crossover Down -2");
  }

  // MACD Score
  if (indicators.macdCrossoverUp && indicators.macdBullish) {
    score += 2;
    reasons.push("Bullish MACD Cross +2");
  } else if (indicators.macdCrossoverDown && indicators.macdBearish) {
    score -= 2;
    reasons.push("Bearish MACD Cross -2");
  }

  // RSI Score
  if (indicators.rsi > 35 && indicators.rsi < 75) {
    score += 1;
    reasons.push("Healthy RSI +1");
  } else if (indicators.rsi < 60) {
    score -= 1;
    reasons.push("Bearish RSI -1");
  }

  // ADX Score
  if (indicators.adx >= 20) {
    const adxScore = Math.min((indicators.adx - 20) / 10, 2);
    score += score > 0 ? adxScore : -adxScore;
    reasons.push(`Strong Trend (ADX: ${indicators.adx.toFixed(1)}) ${score > 0 ? "+" : "-"}${adxScore.toFixed(1)}`);
  }

  return { score, reasons };
}

module.exports = { generateTrendSignal, calculateIndicators };
