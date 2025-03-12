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
            {id: 'timestamp', title: 'Timestamp'},
            {id: 'pair', title: 'Pair'},
            {id: 'type', title: 'Type'},
            {id: 'side', title: 'Side'},
            {id: 'entryPrice', title: 'Entry_Price'},
            {id: 'exitPrice', title: 'Exit_Price'},
            {id: 'amount', title: 'Contracts'},
            {id: 'leverage', title: 'Leverage'},
            {id: 'pnl', title: 'PnL_USDT'},
            {id: 'pnlPercent', title: 'PnL_%'},
            {id: 'score', title: 'Score'},
            {id: 'reason', title: 'Reason'},
            {id: 'duration', title: 'Duration_Hours'},
            {id: 'marketVolume', title: 'Market_Volume'},
            {id: 'marketVolatility', title: 'Volatility_24h'},
            {id: 'marketTrend', title: 'Market_Trend'},
            {id: 'fundingRate', title: 'Funding_Rate'},
            {id: 'openInterest', title: 'Open_Interest'},
            {id: 'liquidations24h', title: 'Liquidations_24h'},
            {id: 'riskRewardRatio', title: 'Risk_Reward'},
            {id: 'maxDrawdown', title: 'Max_Drawdown'},
            {id: 'profitFactor', title: 'Profit_Factor'},
            {id: 'sharpeRatio', title: 'Sharpe_Ratio'},
            {id: 'marketCap', title: 'Market_Cap'},
            {id: 'dominance', title: 'BTC_Dominance'},
            {id: 'indicators', title: 'Key_Indicators'}
        ].map(header => ({
            ...header,
            // Ensure proper CSV formatting
            title: header.title.padEnd(15, ' ')
        }));

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
            entryPrice: tradeData.price?.toFixed(4) || '',
            exitPrice: '',
            amount: tradeData.amount?.toFixed(4) || '',
            leverage: tradeData.leverage || '',
            pnl: '',
            pnlPercent: '',
            score: tradeData.score?.toFixed(2) || '',
            reason: (tradeData.reasoning || []).join(' | '),
            duration: '',
            marketVolume: tradeData.marketData?.volume24h || '',
            marketVolatility: tradeData.marketData?.volatility24h || '',
            marketTrend: tradeData.marketData?.trend || '',
            fundingRate: tradeData.marketData?.fundingRate || '',
            openInterest: tradeData.marketData?.openInterest || '',
            liquidations24h: tradeData.marketData?.liquidations24h || '',
            riskRewardRatio: tradeData.riskRewardRatio || '',
            maxDrawdown: tradeData.maxDrawdown || '',
            profitFactor: tradeData.profitFactor || '',
            sharpeRatio: tradeData.sharpeRatio || '',
            marketCap: tradeData.marketData?.marketCap || '',
            dominance: tradeData.marketData?.btcDominance || '',
            indicators: JSON.stringify(tradeData.indicators || {})
        };

        await this.logTrade(entry);
    }

    async logTradeExit(tradeData) {
        // Calculate trade metrics
        const profitFactor = tradeData.pnl > 0 ? 
            Math.abs(tradeData.pnl / tradeData.initialRisk) : 0;
        
        const riskRewardRatio = Math.abs(
            (tradeData.exitPrice - tradeData.entryPrice) / 
            (tradeData.entryPrice - tradeData.stopLoss)
        );

        const maxDrawdown = Math.abs(
            ((tradeData.lowestPrice || tradeData.exitPrice) - tradeData.entryPrice) / 
            tradeData.entryPrice * 100
        );

        // Calculate Sharpe ratio using daily returns
        const returns = tradeData.pnlPercent / 100;
        const timePeriod = parseFloat(
            ((new Date() - new Date(tradeData.entryTime)) / (1000 * 60 * 60 * 24))
        );
        const sharpeRatio = (returns / timePeriod) / (tradeData.volatility || 0.01);

        const entry = {
            timestamp: new Date().toISOString(),
            pair: tradeData.pair,
            type: 'EXIT',
            side: tradeData.side,
            entryPrice: tradeData.entryPrice?.toFixed(4) || '',
            exitPrice: tradeData.exitPrice?.toFixed(4) || '',
            amount: tradeData.amount?.toFixed(4) || '',
            leverage: tradeData.leverage || '',
            pnl: tradeData.pnl?.toFixed(4) || '',
            pnlPercent: tradeData.pnlPercent?.toFixed(2) || '',
            score: '',
            reason: tradeData.exitReason || '',
            duration: tradeData.entryTime ? 
                ((new Date() - new Date(tradeData.entryTime)) / (1000 * 60 * 60)).toFixed(2) : '',
            marketVolume: tradeData.marketData?.volume24h || '',
            marketVolatility: tradeData.marketData?.volatility24h || '',
            marketTrend: tradeData.marketData?.trend || '',
            fundingRate: tradeData.marketData?.fundingRate || '',
            openInterest: tradeData.marketData?.openInterest || '',
            liquidations24h: tradeData.marketData?.liquidations24h || '',
            riskRewardRatio: riskRewardRatio.toFixed(2) || '',
            maxDrawdown: maxDrawdown.toFixed(2) || '',
            profitFactor: profitFactor.toFixed(2) || '',
            sharpeRatio: sharpeRatio.toFixed(2) || '',
            marketCap: tradeData.marketData?.marketCap || '',
            dominance: tradeData.marketData?.btcDominance || '',
            indicators: JSON.stringify(tradeData.indicators || {})
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