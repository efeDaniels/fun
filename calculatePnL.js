const tradeHistory = require('./tradeExecutor').tradeHistory;

function calculatePnL() {
    let pnl = 0;
    
    for (let i = 0; i < tradeHistory.length - 1; i++) {
        const entry = tradeHistory[i];
        const exit = tradeHistory[i + 1];

        if (entry.side === 'buy' && exit.side === 'sell') {
            const profit = (exit.price - entry.price) * entry.amount;
            pnl += profit;
        } else if (entry.side === 'sell' && exit.side === 'buy') {
            const profit = (entry.price - exit.price) * entry.amount;
            pnl += profit;
        }
    }

    console.log(`💰 Total PnL: ${pnl.toFixed(2)} USD`);
}

module.exports = { calculatePnL };