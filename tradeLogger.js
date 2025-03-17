const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class TradeLogger {
    constructor() {
        this.baseDir = path.join(__dirname, 'trading_data');
        this.csvDir = path.join(this.baseDir, 'trades');
        
        this.createDirectories();
        this.historicalPath = path.join(this.csvDir, 'historical_trades.csv');
        this.dailyPath = path.join(this.csvDir, `daily_${this.getDateString()}.csv`);
        this.initializeCsvWriters();
    }

    createDirectories() {
        [this.baseDir, this.csvDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    initializeCsvWriters() {
        const headers = [
            {id: 'timestamp', title: 'Timestamp'},
            {id: 'pair', title: 'Pair'},
            {id: 'side', title: 'Side'},
            {id: 'entryPrice', title: 'Entry_Price'},
            {id: 'exitPrice', title: 'Exit_Price'},
            {id: 'amount', title: 'Contracts'},
            {id: 'leverage', title: 'Leverage'},
            {id: 'pnl', title: 'PnL_USDT'},
            {id: 'pnlPercent', title: 'PnL_%'},
            {id: 'exitReason', title: 'Exit_Reason'},
            {id: 'duration', title: 'Duration_Hours'}
        ];

        // Create/append to historical file
        this.historicalWriter = createCsvWriter({
            path: this.historicalPath,
            header: headers,
            append: fs.existsSync(this.historicalPath) // Only append if file exists
        });

        // Create new daily file
        this.dailyWriter = createCsvWriter({
            path: this.dailyPath,
            header: headers
        });
    }

    getDateString() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    async logTrade(tradeData) {
        try {
            await Promise.all([
                this.historicalWriter.writeRecords([tradeData]),
                this.dailyWriter.writeRecords([tradeData])
            ]);

            console.log(`
╭─────────── 📝 Trade Logged ───────────╮
│ ${tradeData.pair}
│ ${tradeData.side.toUpperCase()} Position Closed
│ Entry: ${tradeData.entryPrice} → Exit: ${tradeData.exitPrice}
│ PnL: ${tradeData.pnlPercent}% (${tradeData.pnl} USDT)
│ Duration: ${tradeData.duration}h
╰───────────────────────────────────────╯`);
        } catch (err) {
            console.error('❌ Error logging trade:', err);
        }
    }

    async logTradeExit(tradeData) {
        const entryTime = new Date(tradeData.entryTime);
        const duration = tradeData.entryTime ? 
            ((new Date() - entryTime) / (1000 * 60 * 60)).toFixed(2) : '';

        const entry = {
            timestamp: new Date().toISOString(),
            pair: tradeData.pair,
            side: tradeData.side,
            entryPrice: tradeData.entryPrice?.toFixed(4),
            exitPrice: tradeData.exitPrice?.toFixed(4),
            amount: tradeData.amount?.toFixed(4),
            leverage: tradeData.leverage,
            pnl: tradeData.pnl?.toFixed(4),
            pnlPercent: tradeData.pnlPercent?.toFixed(2),
            exitReason: tradeData.exitReason,
            duration
        };

        await this.logTrade(entry);
    }

    async generateDailyReport() {
        const trades = await this.readTodaysTrades();
        const stats = this.calculateStats(trades);
        
        console.log(`
📊 Daily Trading Report
------------------------
Total Trades: ${stats.totalTrades}
Winning Trades: ${stats.winningTrades}
Losing Trades: ${stats.losingTrades}
Win Rate: ${stats.winRate}%
Average PnL: ${stats.avgPnl}%
Best Trade: ${stats.bestTrade}%
Worst Trade: ${stats.worstTrade}%
Total PnL: ${stats.totalPnl}%
------------------------
        `);
    }

    async readTodaysTrades() {
        // Implementation to read today's trades from CSV
        // You might want to use csv-parser package here
    }

    calculateStats(trades) {
        // Implementation to calculate trading statistics
    }
}

module.exports = new TradeLogger(); 