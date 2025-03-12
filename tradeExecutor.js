const ccxt = require("ccxt");
require("dotenv").config();
const tradeLogger = require('./tradeLogger');

// Initialize exchange instance
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
  options: { defaultType: "swap" }, // Ensure we use derivatives (if applicable)
});

// Bot Risk Management Parameters
const RISK_CONFIG = {
  maxAccountRiskPercent: 2, // Max 2% account risk per trade
  maxPositions: 4,
  maxTradesPerPair: 1,
  defaultLeverage: 3,
  maxLeverage: 5,
  minTradeAmount: 20,
  maxTradeAmount: 100
};

// Track trade history
const tradeHistory = [];
const activePairs = new Map(); // Track active trading pairs and their trade counts

/**
 * Set leverage for a symbol (handles leverage modification error)
 */
async function setLeverage(symbol, leverage = RISK_CONFIG.defaultLeverage) {
  try {
    await exchangeInstance.setLeverage(leverage, symbol);
    console.log(`✅ Leverage set to ${leverage}x for ${symbol}`);
  } catch (err) {
    if (err.message.includes("leverage not modified")) {
      console.warn(`⚠️ Leverage for ${symbol} is already set to ${leverage}x.`);
    } else {
      console.error(`❌ Error setting leverage: ${err.message}`);
    }
  }
}

/**
 * Fetch open positions
 */
async function getOpenPositions() {
  try {
    const positions = await exchangeInstance.fetchPositions();
    return positions.filter((pos) => parseFloat(pos.contracts) > 0); // Only active positions
  } catch (err) {
    console.error(`❌ Error fetching positions: ${err.message}`);
    return [];
  }
}

// * Monitor open positions and close them if Unrealized PnL target is hit.

async function monitorPositions() {
  try {
    console.log("🔍 Monitoring active positions...");

    const positions = await exchangeInstance.fetchPositions();
    const openPositions = positions.filter(
      (pos) => parseFloat(pos.contracts) > 0
    );

    console.log(`📊 Active Positions: ${openPositions.length}`);

    for (const position of openPositions) {
      const entryPrice = parseFloat(position.entryPrice);
      const markPrice = parseFloat(position.markPrice);
      const unrealizedPnL = parseFloat(position.unrealizedPnl);
      const contracts = parseFloat(position.contracts);
      const leverage = parseFloat(position.leverage);

      // ✅ Properly format symbol for Bybit API
      const formattedSymbol = position.symbol
        .replace("/", "")
        .replace(":USDT", "");

      // ✅ Correct PnL Calculation (Using Margin)
      const marginUsed = (entryPrice * contracts) / leverage;
      const pnlPercentage = (unrealizedPnL / marginUsed) * 100;

      console.log(
        `🔹 ${
          position.symbol
        }: Entry ${entryPrice}, Mark ${markPrice}, Unrealized PnL: ${unrealizedPnL.toFixed(
          4
        )} USDT (${pnlPercentage.toFixed(2)}%)`
      );

      // 🚀 Close when reaching PnL target
      if (pnlPercentage >= 10 || pnlPercentage <= -20) {
        console.log(
          `⚠️ Closing ${
            position.symbol
          } due to PnL threshold reached. (PnL: ${pnlPercentage.toFixed(2)}%)`
        );

        try {
          const closeOrder = await exchangeInstance.createOrder(
            formattedSymbol,
            "market",
            position.side === "long" ? "sell" : "buy", // Flip side to close
            contracts,
            undefined,
            { reduceOnly: true } // Ensure it's a close order
          );

          console.log(
            `✅ Position Closed: ${formattedSymbol} - ${
              closeOrder.side === "sell" ? "SHORT" : "LONG"
            } - Final PnL: ${pnlPercentage.toFixed(2)}%`
          );

          // Log trade exit
          await tradeLogger.logTradeExit({
            pair: position.symbol,
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice: markPrice,
            amount: position.contracts,
            leverage: position.leverage,
            pnl: unrealizedPnL,
            pnlPercent: pnlPercentage,
            exitReason: `PnL target reached: ${pnlPercentage.toFixed(2)}%`,
            entryTime: position.timestamp
          });
        } catch (closeError) {
          console.error(
            `❌ Error closing ${position.symbol}:`,
            closeError.message
          );
        }
      }
    }

    // ✅ Stop scanning for new trades if max positions are open
    if (openPositions.length >= 5) {
      console.log("⚠️ Max positions reached! Prioritizing PnL monitoring.");
    }
  } catch (err) {
    console.error(`❌ Error monitoring positions: ${err.message}`);
  }
}

/**
 * Calculate position size based on account balance
 */
async function calculatePositionSize() {
  try {
    const balance = await exchangeInstance.fetchBalance();
    const availableUSDT = parseFloat(balance.USDT.free);
    
    // Calculate position size (2% of account)
    const positionSize = (availableUSDT * RISK_CONFIG.maxAccountRiskPercent) / 100;
    
    // Clamp between min and max trade amounts
    return Math.min(
      Math.max(positionSize, RISK_CONFIG.minTradeAmount),
      RISK_CONFIG.maxTradeAmount
    );
  } catch (err) {
    console.error(`❌ Error calculating position size: ${err.message}`);
    return RISK_CONFIG.minTradeAmount; // Fallback to minimum
  }
}

/**
 * Calculate optimal leverage based on volatility
 */
async function calculateLeverage(symbol) {
  try {
    const candles = await exchangeInstance.fetchOHLCV(symbol, '1h', undefined, 24);
    
    // Calculate 24h volatility
    const volatility = candles.reduce((sum, candle) => 
      sum + Math.abs(candle[2] - candle[3]) / candle[4], 0) / candles.length;
    
    // Adjust leverage based on volatility
    let leverage = RISK_CONFIG.defaultLeverage;
    if (volatility > 0.05) leverage--; // High volatility -> lower leverage
    if (volatility < 0.02) leverage++; // Low volatility -> higher leverage
    
    return Math.min(Math.max(leverage, 1), RISK_CONFIG.maxLeverage);
  } catch (err) {
    console.error(`❌ Error calculating leverage: ${err.message}`);
    return RISK_CONFIG.defaultLeverage;
  }
}

/**
 * Calculate maximum possible position size based on available balance
 */
async function calculateAvailablePositionSize(symbol, leverage) {
    try {
        const balance = await exchangeInstance.fetchBalance();
        const availableUSDT = parseFloat(balance.USDT.free);
        
        // Get current price
        const ticker = await exchangeInstance.fetchTicker(symbol);
        const currentPrice = ticker.last;

        // Calculate total position value (margin * leverage)
        const totalPositionValue = RISK_CONFIG.minTradeAmount * leverage; // This will be 20 * 3 = 60 USDT
        const requiredMargin = RISK_CONFIG.minTradeAmount; // This will be 20 USDT

        if (availableUSDT < requiredMargin) {
            console.log(`⚠️ Insufficient margin: Need ${requiredMargin.toFixed(2)} USDT, have ${availableUSDT.toFixed(2)} USDT`);
            return 0;
        }

        // Calculate contracts amount for the leveraged position size
        const contractSize = totalPositionValue / currentPrice;
        
        console.log(`💰 Total Position Value: $${totalPositionValue}`);
        console.log(`📊 Required Margin: ${requiredMargin.toFixed(2)} USDT`);
        console.log(`📈 Contract Size: ${contractSize.toFixed(6)}`);

        return contractSize;
    } catch (err) {
        console.error(`❌ Error calculating position size: ${err.message}`);
        return 0;
    }
}

/**
 * Execute trade with dynamic position sizing and leverage
 */
async function executeTrade(symbol, side, amount, score, reasoning = []) {
    try {
        // Check existing positions first
        if (activePairs.has(symbol)) {
            console.log(`⚠️ Active position already exists for ${symbol}, skipping trade`);
            return null;
        }

        if (activePairs.size >= RISK_CONFIG.maxPositions) {
            console.log(`⚠️ Max positions (${RISK_CONFIG.maxPositions}) reached, skipping trade`);
            return null;
        }

        // Get optimal leverage
        const leverage = await calculateLeverage(symbol);
        
        // Calculate contract size
        const contractSize = await calculateAvailablePositionSize(symbol, leverage);
        
        if (contractSize <= 0) {
            console.log(`⚠️ Cannot calculate valid position size`);
            return null;
        }

        console.log(
            `🛒 Attempting ${side.toUpperCase()} trade for ${symbol}:`,
            `\n💰 Contracts: ${contractSize}`,
            `\n📊 Leverage: ${leverage}x`
        );

        // Execute market order with contract size
        const order = await exchangeInstance.createOrder(
            symbol,
            "market",
            side,
            contractSize,
            undefined,
            {
                reduceOnly: false,
                closeOnTrigger: false,
                leverage: leverage
            }
        );

        console.log(
            `✅ Trade executed: ${order.id} - ${side.toUpperCase()} ${contractSize} of ${symbol}`
        );

        // Add to active positions if successful
        if (order) {
            activePairs.set(symbol, {
                side: side,
                amount: contractSize,
                entryPrice: order.price,
                timestamp: new Date().getTime()
            });

            // Log trade entry with safe reasoning
            await tradeLogger.logTradeEntry({
                pair: symbol,
                side: side,
                price: order.price,
                amount: contractSize,
                leverage: leverage,
                score: score,
                reasoning: Array.isArray(reasoning) ? reasoning : [] // Ensure reasoning is an array
            });
        }

        return order;
    } catch (err) {
        console.error(`❌ Error executing trade: ${err.message}`);
        return null;
    }
}

module.exports = {
  executeTrade,
  tradeHistory,
  monitorPositions,
  getOpenPositions,
  RISK_CONFIG,
};
