const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class TradeLogger {
    constructor() {
        // Create directory structure
        this.baseDir = path.join(__dirname, 'trading_data');
        this.logsDir = path.join(this.baseDir, 'logs');
        this.csvDir = path.join(this.baseDir, 'trades');
        
        this.createDirectories();

        // Paths for different CSV files
        this.historicalPath = path.join(this.csvDir, 'historical_trades.csv');
        this.dailyPath = path.join(this.csvDir, `daily_${this.getDateString()}.csv`);

        // Initialize CSV writers
        this.initializeCsvWriters();
    }

    createDirectories() {
        // Create directory structure if it doesn't exist
        [this.baseDir, this.logsDir, this.csvDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    initializeCsvWriters() {
        const headers = [
            {id: 'timestamp', title: 'TIMESTAMP'},
            {id: 'pair', title: 'PAIR'},
            {id: 'type', title: 'TYPE'},
            {id: 'side', title: 'SIDE'},
            {id: 'entryPrice', title: 'ENTRY_PRICE'},
            {id: 'exitPrice', title: 'EXIT_PRICE'},
            {id: 'amount', title: 'AMOUNT'},
            {id: 'leverage', title: 'LEVERAGE'},
            {id: 'pnl', title: 'PNL'},
            {id: 'pnlPercent', title: 'PNL_PERCENT'},
            {id: 'score', title: 'ENTRY_SCORE'},
            {id: 'reason', title: 'REASON'},
            {id: 'duration', title: 'DURATION_HOURS'}
        ];

        // Create/append to historical file
        this.historicalWriter = createCsvWriter({
            path: this.historicalPath,
            header: headers,
            append: true // Append to existing file
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
            // Write to both historical and daily files
            await Promise.all([
                this.historicalWriter.writeRecords([tradeData]),
                this.dailyWriter.writeRecords([tradeData])
            ]);

            console.log(`📝 Trade logged successfully [${tradeData.type}]`);
        } catch (err) {
            console.error('❌ Error logging trade:', err);
        }
    }

    async logTradeEntry(tradeData) {
        const entry = {
            timestamp: new Date().toISOString(),
            pair: tradeData.pair,
            type: 'ENTRY',
            side: tradeData.side,
            entryPrice: tradeData.price,
            exitPrice: null,
            amount: tradeData.amount,
            leverage: tradeData.leverage,
            pnl: null,
            pnlPercent: null,
            score: tradeData.score,
            reason: tradeData.reasoning.join(' | '),
            duration: null
        };

        await this.logTrade(entry);
    }

    async logTradeExit(tradeData) {
        const entry = {
            timestamp: new Date().toISOString(),
            pair: tradeData.pair,
            type: 'EXIT',
            side: tradeData.side,
            entryPrice: tradeData.entryPrice,
            exitPrice: tradeData.exitPrice,
            amount: tradeData.amount,
            leverage: tradeData.leverage,
            pnl: tradeData.pnl,
            pnlPercent: tradeData.pnlPercent,
            score: null,
            reason: tradeData.exitReason,
            duration: ((new Date() - new Date(tradeData.entryTime)) / (1000 * 60 * 60)).toFixed(2)
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