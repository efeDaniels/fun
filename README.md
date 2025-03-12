# Bybit Futures Trading Bot

A focused **Bybit Futures Trading Bot** that trades major cryptocurrency pairs using technical analysis, support/resistance levels, and a comprehensive scoring system. Built with risk management and reliability in mind.

---

## Key Features

- **Selective Trading**: Trades only established cryptocurrencies (BTC, ETH, SOL, etc.)
- **Technical Analysis**: Uses EMA, RSI, MACD, and ADX for trend confirmation
- **Support/Resistance**: Incorporates S/R levels for better entry/exit points
- **Smart Scoring System**: Multi-factor scoring for trade evaluation
- **Dynamic Position Sizing**: Risk-based position sizing (2% account risk per trade)
- **Smart Leverage**: Adjusts leverage (1x-5x) based on market volatility
- **Risk Management**: 
  - Maximum 4 open positions
  - Take profit at +10%
  - Stop loss at -20%
  - Maximum 1 trade per pair

---

## Trading Strategy

### 1. Technical Indicators
- EMA (50 & 200) crossover
- MACD crossover & direction
- RSI confirmation (35-75 for longs, <60 for shorts)
- ADX > 20 (ensures strong trend)

### 2. Market Conditions
- Minimum $50k 24h volume
- Maximum 0.1% spread
- Support/Resistance level confirmation

### 3. Scoring System

The bot uses a comprehensive scoring system (±9 points max) considering:

#### Volume Score (±3 points)
- 10,000 USDT = 0 points
- 100,000 USDT = ±1 point
- 1,000,000 USDT = ±2 points
- 10,000,000+ USDT = ±3 points

#### Spread Score (±1 point)
- < 0.1% spread = ±1 point
- ≥ 0.1% spread = 0 points

#### Support/Resistance Score (±3 points)
- Based on level strength and proximity
- Stronger levels = higher score
- Closer proximity = higher score
- Example: Strong support nearby = +3 for longs

#### Trend Strength (ADX) Score (±2 points)
- ADX 25 = 0 points
- ADX 35 = ±1 point
- ADX 45+ = ±2 points

#### Market Condition Penalties
- Choppy market between S/R = Score halved
- Range < 2% with strong S/R = Score reduced

### Example Scenarios

**Perfect LONG Signal (+9):**
```json
{
    "volumeScore": "+3",    // High volume
    "spreadScore": "+1",    // Tight spread
    "supportScore": "+3",   // Strong support
    "trendScore": "+2",     // Strong ADX
    "total": "+9"          // Very strong long
}
```

**Perfect SHORT Signal (-9):**
```json
{
    "volumeScore": "-3",    // High volume
    "spreadScore": "-1",    // Tight spread
    "resistanceScore": "-3", // Strong resistance
    "trendScore": "-2",     // Strong ADX
    "total": "-9"          // Very strong short
}
```

Trade execution requires:
- Long positions: Score > +2
- Short positions: Score < -2
- Higher absolute scores = stronger signals

---

## Installation

### 1- Clone the Repository
```bash
git clone https://github.com/efeDaniels/fun.git
cd trading-bot
```

### 2- Install Dependencies
```bash
npm install
```

### 3- Configure Environment
Create a `.env` file:
```plaintext
API_KEY=your_bybit_api_key
API_SECRET=your_bybit_api_secret
```

Get your API credentials from [Bybit API Management](https://www.bybit.com/app/user/api-management)

---

## How It Works

### Trading Pairs
Only trades established cryptocurrencies:
- BTC/USDT
- ETH/USDT
- SOL/USDT
- BNB/USDT
- XRP/USDT
- AVAX/USDT
- MATIC/USDT
- And other major pairs

### Entry Conditions
1. **Technical Indicators**:
   - EMA (50 & 200) crossover
   - MACD crossover & direction
   - RSI confirmation (35-75 for longs, <60 for shorts)
   - ADX > 20 (ensures strong trend)

2. **Market Conditions**:
   - Minimum $50k 24h volume
   - Maximum 0.1% spread
   - Support/Resistance level confirmation

### Position Management
- **Position Size**: 2% of account balance (min $20, max $100)
- **Leverage**: Dynamic 1x-5x based on volatility
- **Take Profit**: +10% unrealized PnL
- **Stop Loss**: -20% unrealized PnL
- **Maximum Risk**: 4 concurrent positions

---

## Running the Bot

Start the bot:
```bash
node bot.js
```

For 24/7 operation using PM2:
```bash
pm2 start bot.js --name "trading-bot"
```

Monitor logs:
```bash
pm2 logs trading-bot
```

Stop the bot:
```bash
pm2 stop trading-bot
```

---

## Core Files

- **`bot.js`**: Main entry point, market analysis and scoring system
- **`trendStrategy.js`**: Technical analysis and signal generation
- **`tradeExecutor.js`**: Order execution and position management
- **`support_resistance.js`**: Support/Resistance level detection

---

## ⚠️ Risk Warning

This bot is for educational purposes. Cryptocurrency trading involves substantial risk. Always:
- Test in testnet first
- Start with small amounts
- Never trade more than you can afford to lose
- Monitor the bot's performance regularly
- Understand that past performance doesn't guarantee future results

---



