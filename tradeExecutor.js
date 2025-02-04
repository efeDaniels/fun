const ccxt = require("ccxt");
require("dotenv").config();

// Initialize exchange instance
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
  options: { defaultType: "swap" }, // Ensure we use derivatives (if applicable)
});

// Bot Parameters
const FIXED_TRADE_AMOUNT = 10; // Always trade exactly $10 per position
const DEFAULT_LEVERAGE = 5; // Set default leverage
const MAX_OPEN_POSITIONS = 5; // Limit total open positions
const MAX_TRADES_PER_PAIR = 1; // Limit max trades per pair

// Track trade history
const tradeHistory = [];
const activePairs = new Map(); // Track active trading pairs and their trade counts

/**
 * Set leverage for a symbol (handles leverage modification error)
 */
async function setLeverage(symbol, leverage = DEFAULT_LEVERAGE) {
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
        return positions.filter(pos => parseFloat(pos.contracts) > 0); // Only active positions
    } catch (err) {
        console.error(`❌ Error fetching positions: ${err.message}`);
        return [];
    }
}

/**
 * Monitor open positions and log PnL updates
 */
async function monitorPositions() {
    try {
        const openPositions = await getOpenPositions();
        if (openPositions.length === 0) {
            console.log("🔍 No open positions.");
            activePairs.clear(); // Reset active pairs when no positions are left
            return;
        }

        console.log(`📊 Monitoring ${openPositions.length} open positions:`);
        for (const position of openPositions) {
            const entryPrice = parseFloat(position.entryPrice);
            const currentPrice = (await exchangeInstance.fetchTicker(position.symbol)).last;
            const pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;

            console.log(`🔹 ${position.symbol}: Entry ${entryPrice}, Current ${currentPrice}, PnL: ${pnlPercentage.toFixed(2)}%`);

            // Stop loss at -5%
            if (pnlPercentage <= -5) {
                console.log(`❌ STOP LOSS: Closing ${position.symbol} at -5% loss`);
                await exchangeInstance.createOrder(position.symbol, "market", position.side === "buy" ? "sell" : "buy", position.contracts);
                activePairs.delete(position.symbol); // Remove from active tracking
            }
            // Take profit at +5%
            if (pnlPercentage >= 5) {
                console.log(`✅ TAKE PROFIT: Closing ${position.symbol} at +5% profit`);
                await exchangeInstance.createOrder(position.symbol, "market", position.side === "buy" ? "sell" : "buy", position.contracts);
                activePairs.delete(position.symbol); // Remove from active tracking
            }
        }
    } catch (err) {
        console.error(`❌ Error monitoring positions: ${err.message}`);
    }
}

/**
 * Execute trade (ensures fixed $10 per trade & prevents multiple trades per pair)
 */
async function executeTrade(symbol, side) {
    try {
        console.log(`🛒 Attempting ${side.toUpperCase()} trade for ${symbol} with $${FIXED_TRADE_AMOUNT} margin`);

        // Fetch active positions
        const openPositions = await getOpenPositions();

        // Enforce max open positions
        if (openPositions.length >= MAX_OPEN_POSITIONS) {
            console.log("⚠️ Max positions reached (5). Monitoring existing trades...");
            return;
        }

        // Prevent multiple trades on the same pair
        const currentTrades = activePairs.get(symbol) || 0;
        if (currentTrades >= MAX_TRADES_PER_PAIR) {
            console.log(`⚠️ Skipping trade. Max trades (${MAX_TRADES_PER_PAIR}) reached for ${symbol}.`);
            return;
        }

        // Fetch market price
        const ticker = await exchangeInstance.fetchTicker(symbol);
        const price = ticker.last || ticker.close;

        if (!price || price <= 0) {
            console.log(`❌ Invalid market price for ${symbol}. Skipping trade.`);
            return;
        }

        // Set leverage
        await setLeverage(symbol, DEFAULT_LEVERAGE);

        // Calculate total position size
        let totalPositionSize = FIXED_TRADE_AMOUNT * DEFAULT_LEVERAGE; // Ex: $10 margin * 5x = $50 position
        let amount = totalPositionSize / price;

        // Ensure amount meets exchange minimum
        const market = exchangeInstance.market(symbol);
        const minTradeSize = market.limits.amount.min || 1;
        if (amount < minTradeSize) {
            console.log(`⚠️ Trade amount too low. Adjusting to minimum required (${minTradeSize})`);
            amount = minTradeSize;
        }

        // Execute market order
        const order = await exchangeInstance.createOrder(symbol, "market", side, amount);
        console.log(`✅ Trade executed: ${order.id} - ${side.toUpperCase()} ${amount} of ${symbol}`);

        tradeHistory.push(order);
        activePairs.set(symbol, currentTrades + 1); // Increment trade count for this pair
    } catch (err) {
        console.error(`❌ Error executing trade: ${err.message}`);
    }
}

module.exports = { executeTrade, tradeHistory, monitorPositions };
