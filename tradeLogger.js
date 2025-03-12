const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class TradeLogger {
    constructor() {
        // Create directory structure
        this.baseDir = path.join(__dirname, 'trading_data');
        this.logsDir = path.join(this.baseDir, 'logs');
        this.csvDir = path.join(this.baseDir, 'trades');
        this.postTradeDir = path.join(this.baseDir, 'post_trade_analysis');
        
        this.createDirectories();

        // Paths for different CSV files
        this.historicalPath = path.join(this.csvDir, 'historical_trades.csv');
        this.dailyPath = path.join(this.csvDir, `daily_${this.getDateString()}.csv`);

        // Initialize CSV writers
        this.initializeCsvWriters();

        this.activeTrackings = new Map(); // Store active post-trade trackings
        this.startTrackingLoop();
    }

    createDirectories() {
        // Create directory structure if it doesn't exist
        [this.baseDir, this.logsDir, this.csvDir, this.postTradeDir].forEach(dir => {
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

    async logPostTradeMetrics(tradeData, priceData) {
        const filename = `${tradeData.pair}_${new Date(tradeData.exitTime).toISOString()}.txt`;
        const filepath = path.join(this.postTradeDir, filename);

        const timeIntervals = [30, 60, 120, 180, 240, 360]; // 30m, 1h, 2h, 3h, 4h, 6h
        let bestPrice = tradeData.exitPrice;
        let worstPrice = tradeData.exitPrice;

        let content = `
════════════════════════════════════════════
           POST-TRADE ANALYSIS
════════════════════════════════════════════

PAIR        : ${tradeData.pair}
EXIT TIME   : ${new Date(tradeData.exitTime).toISOString()}
SIDE        : ${tradeData.side}
SIZE        : ${tradeData.amount} (${tradeData.leverage}x)
EXIT PRICE  : ${tradeData.exitPrice} USDT
CLOSED PNL  : ${tradeData.pnl} USDT (${tradeData.pnlPercent}%)

════════════════════════════════════════════
           PRICE MOVEMENT ANALYSIS
════════════════════════════════════════════\n`;

        for (const minutes of timeIntervals) {
            const price = priceData[minutes];
            if (!price) continue;

            bestPrice = Math.max(bestPrice, price);
            worstPrice = Math.min(worstPrice, price);

            const priceDiff = tradeData.side === 'LONG' 
                ? (price - tradeData.exitPrice) 
                : (tradeData.exitPrice - price);
            
            const hypotheticalPnl = priceDiff * tradeData.amount * tradeData.leverage;
            const pnlPercent = (hypotheticalPnl / (tradeData.amount * tradeData.exitPrice)) * 100;
            const priceChangePercent = ((price - tradeData.exitPrice) / tradeData.exitPrice * 100);

            const timeDisplay = minutes >= 60 
                ? `${minutes/60} HOUR${minutes/60 > 1 ? 'S' : ''}` 
                : `${minutes} MINUTES`;

            content += `
▸ AFTER ${timeDisplay}
  • Price          : ${price} USDT
  • Price Change   : ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%
  • Potential PNL  : ${hypotheticalPnl.toFixed(2)} USDT
  • PNL Change     : ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
  • Total if Held  : ${(parseFloat(tradeData.pnl) + hypotheticalPnl).toFixed(2)} USDT
──────────────────────────────────────────\n`;
        }

        const isOptimalExit = tradeData.side === 'LONG' 
            ? (bestPrice <= tradeData.exitPrice) 
            : (worstPrice >= tradeData.exitPrice);

        const bestPricePercent = ((bestPrice - tradeData.exitPrice) / tradeData.exitPrice * 100);
        const worstPricePercent = ((worstPrice - tradeData.exitPrice) / tradeData.exitPrice * 100);

        content += `
════════════════════════════════════════════
                 SUMMARY
════════════════════════════════════════════
BEST PRICE   : ${bestPrice} (${bestPricePercent >= 0 ? '+' : ''}${bestPricePercent.toFixed(2)}%)
WORST PRICE  : ${worstPrice} (${worstPricePercent >= 0 ? '+' : ''}${worstPricePercent.toFixed(2)}%)
TREND        : ${bestPrice > tradeData.exitPrice ? '📈 UPWARD' : '📉 DOWNWARD'}
OPTIMAL EXIT : ${isOptimalExit ? '✅ YES' : '❌ NO'}
════════════════════════════════════════════`;

        await fs.promises.writeFile(filepath, content);
        console.log(`📊 Post-trade analysis saved for ${tradeData.pair}`);
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
        
        // Initialize post-trade tracking
        await this.initializePostTradeTracking(tradeData);
    }

    async initializePostTradeTracking(tradeData) {
        const tradeId = `${tradeData.pair}_${Date.now()}`;
        const intervals = [30, 60, 120, 180, 240, 360];
        
        // Initialize tracking
        this.activeTrackings.set(tradeId, {
            tradeData,
            intervals,
            startTime: Date.now(),
            completed: new Set()
        });

        // Create initial file
        await this.createInitialAnalysisFile(tradeData);
    }

    async updatePostTradeAnalysis(tradeData, minutes) {
        try {
            const ticker = await exchange.fetchTicker(tradeData.pair);
            const currentPrice = ticker.last;
            
            // Update analysis file with new price data
            // ... existing price update code ...
            
            console.log(`📊 Updated ${tradeData.pair} analysis after ${minutes} minutes`);
        } catch (err) {
            console.error(`Failed to update analysis for ${tradeData.pair}:`, err);
        }
    }

    // Save tracking data to persist through restarts
    async saveTrackingState() {
        const state = Array.from(this.activeTrackings.entries());
        await fs.promises.writeFile(
            path.join(this.postTradeDir, 'tracking_state.json'),
            JSON.stringify(state)
        );
    }

    // Load tracking state on startup
    async loadTrackingState() {
        try {
            const statePath = path.join(this.postTradeDir, 'tracking_state.json');
            if (await fs.promises.access(statePath).then(() => true).catch(() => false)) {
                const state = JSON.parse(await fs.promises.readFile(statePath));
                this.activeTrackings = new Map(state);
            }
        } catch (err) {
            console.error('Failed to load tracking state:', err);
        }
    }

    startTrackingLoop() {
        // Check every 15 minutes instead of every minute
        setInterval(async () => {
            const now = Date.now();
            
            for (const [tradeId, tracking] of this.activeTrackings) {
                const { tradeData, intervals, startTime } = tracking;
                
                // Check each remaining interval
                for (const minutes of intervals) {
                    const targetTime = startTime + (minutes * 60 * 1000);
                    const timeBuffer = 15 * 60 * 1000; // 15 minutes buffer
                    
                    // If we're within the buffer of the target time and haven't completed this interval
                    if (now >= targetTime && now <= targetTime + timeBuffer && !tracking.completed.has(minutes)) {
                        await this.updatePostTradeAnalysis(tradeData, minutes);
                        tracking.completed.add(minutes);
                        
                        // If all intervals are done, remove from active trackings
                        if (tracking.completed.size === intervals.length) {
                            await this.finalizePostTradeAnalysis(tradeData);
                            this.activeTrackings.delete(tradeId);
                        }

                        // Add delay between API calls if multiple intervals hit
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        }, 15 * 60 * 1000); // Check every 15 minutes
    }

    async createInitialAnalysisFile(tradeData) {
        const exitTime = new Date();
        const filename = `${tradeData.pair}_${exitTime.toISOString()}.txt`;
        const filepath = path.join(this.postTradeDir, filename);

        const timeIntervals = [30, 60, 120, 180, 240, 360];
        let content = `
════════════════════════════════════════════
           POST-TRADE ANALYSIS
════════════════════════════════════════════

PAIR        : ${tradeData.pair}
EXIT TIME   : ${exitTime.toISOString()}
SIDE        : ${tradeData.side}
SIZE        : ${tradeData.amount} (${tradeData.leverage}x)
EXIT PRICE  : ${tradeData.exitPrice} USDT
CLOSED PNL  : ${tradeData.pnl} USDT (${tradeData.pnlPercent}%)

════════════════════════════════════════════
           PRICE MOVEMENT ANALYSIS
════════════════════════════════════════════
`;

        for (const minutes of timeIntervals) {
            const price = await this.fetchPostTradePrices(tradeData.pair, exitTime, [minutes])[minutes];
            if (!price) continue;

            const priceChangePercent = ((price - tradeData.exitPrice) / tradeData.exitPrice * 100);

            const timeDisplay = minutes >= 60 
                ? `${minutes/60} HOUR${minutes/60 > 1 ? 'S' : ''}` 
                : `${minutes} MINUTES`;

            content += `
▸ AFTER ${timeDisplay}
  • Price          : ${price} USDT
  • Price Change   : ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%
  • Total if Held  : ${(parseFloat(tradeData.pnl) + (price - tradeData.exitPrice) * tradeData.amount * tradeData.leverage).toFixed(2)} USDT
──────────────────────────────────────────\n`;
        }

        content += `
════════════════════════════════════════════
                 SUMMARY
════════════════════════════════════════════
BEST PRICE   : ${tradeData.exitPrice} (${tradeData.pnlPercent}%)
WORST PRICE  : ${tradeData.exitPrice} (${tradeData.pnlPercent}%)
TREND        : ${tradeData.pnl > 0 ? '📈 UPWARD' : '📉 DOWNWARD'}
OPTIMAL EXIT : ${tradeData.side === 'LONG' ? 
                    (tradeData.exitPrice >= tradeData.exitPrice ? '✅ YES' : '❌ NO') : 
                    (tradeData.exitPrice <= tradeData.exitPrice ? '✅ YES' : '❌ NO')}
════════════════════════════════════════════`;

        await fs.promises.writeFile(filepath, content);
        console.log(`📊 Post-trade analysis saved for ${tradeData.pair}`);
    }

    async finalizePostTradeAnalysis(tradeData) {
        const exitTime = new Date();
        const filename = `${tradeData.pair}_${exitTime.toISOString()}.txt`;
        const filepath = path.join(this.postTradeDir, filename);

        const timeIntervals = [30, 60, 120, 180, 240, 360];
        let content = `
════════════════════════════════════════════
           POST-TRADE ANALYSIS
════════════════════════════════════════════

PAIR        : ${tradeData.pair}
EXIT TIME   : ${exitTime.toISOString()}
SIDE        : ${tradeData.side}
SIZE        : ${tradeData.amount} (${tradeData.leverage}x)
EXIT PRICE  : ${tradeData.exitPrice} USDT
CLOSED PNL  : ${tradeData.pnl} USDT (${tradeData.pnlPercent}%)

════════════════════════════════════════════
           PRICE MOVEMENT ANALYSIS
════════════════════════════════════════════
`;

        for (const minutes of timeIntervals) {
            const price = await this.fetchPostTradePrices(tradeData.pair, exitTime, [minutes])[minutes];
            if (!price) continue;

            const priceChangePercent = ((price - tradeData.exitPrice) / tradeData.exitPrice * 100);

            const timeDisplay = minutes >= 60 
                ? `${minutes/60} HOUR${minutes/60 > 1 ? 'S' : ''}` 
                : `${minutes} MINUTES`;

            content += `
▸ AFTER ${timeDisplay}
  • Price          : ${price} USDT
  • Price Change   : ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%
  • Total if Held  : ${(parseFloat(tradeData.pnl) + (price - tradeData.exitPrice) * tradeData.amount * tradeData.leverage).toFixed(2)} USDT
──────────────────────────────────────────\n`;
        }

        content += `
════════════════════════════════════════════
                 SUMMARY
════════════════════════════════════════════
BEST PRICE   : ${tradeData.exitPrice} (${tradeData.pnlPercent}%)
WORST PRICE  : ${tradeData.exitPrice} (${tradeData.pnlPercent}%)
TREND        : ${tradeData.pnl > 0 ? '📈 UPWARD' : '📉 DOWNWARD'}
OPTIMAL EXIT : ${tradeData.side === 'LONG' ? 
                    (tradeData.exitPrice >= tradeData.exitPrice ? '✅ YES' : '❌ NO') : 
                    (tradeData.exitPrice <= tradeData.exitPrice ? '✅ YES' : '❌ NO')}
════════════════════════════════════════════`;

        await fs.promises.writeFile(filepath, content);
        console.log(`📊 Post-trade analysis saved for ${tradeData.pair}`);
    }

    async fetchPostTradePrices(pair, exitTime, intervals) {
        const prices = {};
        const exitTimeMs = new Date(exitTime).getTime();
        const currentTime = Date.now();

        try {
            // Get initial exit price for reference
            const exitKline = await exchange.fetchOHLCV(
                pair,
                '1m',
                exitTimeMs,
                1
            );

            if (exitKline && exitKline[0]) {
                prices[0] = exitKline[0][4]; // Store exit price
            }

            // Filter which intervals we can fetch now
            const readyToFetch = intervals.filter(minutes => 
                (exitTimeMs + (minutes * 60 * 1000)) <= currentTime
            );

            // Fetch available prices
            for (const minutes of readyToFetch) {
                const targetTime = exitTimeMs + (minutes * 60 * 1000);
                
                try {
                    const klines = await exchange.fetchOHLCV(
                        pair,
                        '1m',
                        targetTime,
                        1
                    );

                    if (klines && klines[0]) {
                        prices[minutes] = klines[0][4]; // Store close price
                    }

                    // Rate limit protection
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error(`Failed to fetch ${minutes}m price for ${pair}:`, err.message);
                }
            }

            // Schedule future price fetches
            const futureIntervals = intervals.filter(minutes => 
                (exitTimeMs + (minutes * 60 * 1000)) > currentTime
            );

            for (const minutes of futureIntervals) {
                const targetTime = exitTimeMs + (minutes * 60 * 1000);
                const delay = targetTime - currentTime;

                setTimeout(async () => {
                    try {
                        const klines = await exchange.fetchOHLCV(
                            pair,
                            '1m',
                            targetTime,
                            1
                        );

                        if (klines && klines[0]) {
                            prices[minutes] = klines[0][4];
                            // Update the analysis file with new data
                            await this.updatePostTradeAnalysis(pair, exitTime, minutes, prices[minutes]);
                        }
                    } catch (err) {
                        console.error(`Failed to fetch future ${minutes}m price for ${pair}:`, err.message);
                    }
                }, delay);
            }

        } catch (err) {
            console.error('Error fetching post-trade prices:', err);
        }

        return prices;
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