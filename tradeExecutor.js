const ccxt = require("ccxt");
require("dotenv").config();

// Initialize exchange instance
const exchangeInstance = new ccxt.bybit({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  enableRateLimit: true,
  options: { defaultType: "swap" }, // Ensure we use derivatives (if applicable)
});

// Keep a history of trades in memory
const tradeHistory = [];
const MAX_OPEN_POSITIONS = 5; // Limit total open positions
const MAX_TRADES_PER_PAIR = 1; // Limit trades per pair

/**
 * Set leverage for a symbol (ignores "leverage not modified" error)
 */
async function setLeverage(symbol, leverage = 5) {
    try {
        await exchangeInstance.setLeverage(leverage, symbol);
        console.log(`✅ Leverage set to ${leverage}x for ${symbol}`);
    } catch (err) {
        if (err.message.includes("leverage not modified")) {
            console.warn(`⚠️ Leverage for ${symbol} is already set to ${leverage}x. Skipping change.`);
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
        return positions.filter(pos => parseFloat(pos.contracts) > 0); // Return only active positions
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
            return;
        }

        console.log(`📊 Monitoring ${openPositions.length} open positions:`);
        for (const position of openPositions) {
            const entryPrice = parseFloat(position.entryPrice);
            const currentPrice = (await exchangeInstance.fetchTicker(position.symbol)).last;
            const pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;

            console.log(`🔹 ${position.symbol}: Entry ${entryPrice}, Current ${currentPrice}, PnL: ${pnlPercentage.toFixed(2)}%`);

            // Auto-close trades if profit/loss target is hit (5% profit, -5% loss)
            if (pnlPercentage >= 5 || pnlPercentage <= -5) {
                console.log(`✅ Closing ${position.symbol} as PnL target reached`);
                await exchangeInstance.createOrder(position.symbol, "market", position.side === "buy" ? "sell" : "buy", position.contracts);
            }
        }
    } catch (err) {
        console.error(`❌ Error monitoring positions: ${err.message}`);
    }
}

/**
 * Execute trade (Prevents multiple trades on the same pair)
 */
async function executeTrade(symbol, side, usdtAmount = 10) {
    try {
        console.log(`🛒 Attempting ${side.toUpperCase()} trade for ${symbol} with ${usdtAmount} USDT`);

        // Check open positions
        const positions = await getOpenPositions();
        const openPositions = positions.filter(pos => pos.contracts > 0);

        // Limit total positions to 5
        if (openPositions.length >= MAX_OPEN_POSITIONS) {
            console.log("⚠️ Max positions reached (5). Monitoring existing trades...");
            return;
        }

        // Check if we already have an open position for this pair
        const existingPosition = openPositions.find(pos => pos.symbol === symbol);
        if (existingPosition) {
            console.log(`⚠️ Skipping trade for ${symbol}, already have an open position.`);
            return; // Skip if a trade is already open for this pair
        }

        // Fetch market details to get price and contract size
        const ticker = await exchangeInstance.fetchTicker(symbol);
        const market = exchangeInstance.market(symbol);
        const price = ticker.last || ticker.close;

        if (!price || price <= 0) {
            console.log(`❌ Invalid market price for ${symbol}. Skipping trade.`);
            return;
        }

        // Ensure leverage is set
        await setLeverage(symbol, 5);

        // Calculate the amount to trade (USDT divided by price)
        let amount = usdtAmount / price;

        // Ensure amount meets the exchange minimum
        const minTradeSize = market.limits.amount.min || 1;
        if (amount < minTradeSize) {
            console.log(`⚠️ Trade amount too low. Adjusting to minimum required (${minTradeSize})`);
            amount = minTradeSize;
        }

        // Place the trade
        const order = await exchangeInstance.createOrder(symbol, "market", side, amount);
        console.log(`✅ Trade executed: ${order.id} - ${side.toUpperCase()} ${amount} of ${symbol}`);

        tradeHistory.push(order);
    } catch (err) {
        console.error(`❌ Error executing trade: ${err.message}`);
    }
}

module.exports = { executeTrade, tradeHistory, monitorPositions };
