# WTF IS THAT

A fully automated **Bybit Futures Trading Bot** that scans the market for the best trading opportunities, executes trades, and manages positions based on technical indicators. The bot ensures effective risk management while optimizing trade execution.

---

## WTF IT DOES

- **Automated Market Scanning**: Finds high-volume, low-spread pairs.
- **Trade Execution**: Opens and manages trades based on EMA, RSI, and MACD signals.
- **Dynamic Position Monitoring**: Closes trades when profit or stop-loss levels are reached.
- **Adjustable Parameters**: Trade amount, leverage, and position limits can be customized.
- **Execution**: Trades are executed in a structured manner to avoid overloading the API.

---

##  Installation

### 1- Clone the Repository
```bash
  git clone https://github.com/efeDaniels/fun.git
  cd trading-bot
```

### 2- Install Dependencies
```bash
  npm install
```

or if using **Yarn**:
```bash
  yarn install
```

### 3- Set Up Environment Variables
Create a `.env` file in the root directory and add the following keys:

```plaintext
API_KEY=your_bybit_api_key
API_SECRET=your_bybit_api_secret
```

You can get your **API Key** and **Secret** from [Bybit API Management](https://www.bybit.com/app/user/api-management).

---

## ⚙️ How It Works

1. **Monitoring Active Positions**: The bot first checks open positions and tracks their Unrealized PnL.
2. **Position Management**: If a trade reaches **profit target (+15%)** or **stop-loss (-15%)**, the bot closes the position.
3. **Pair Selection**: If there are available trade slots, it scans **all available USDT trading pairs**.
4. **Filtering Criteria**:
   - **Volume:** Excludes low-volume markets (< 500K USDT).
   - **Spread:** Avoids pairs with a high bid-ask spread (> 0.5 USDT).
   - **Technical Indicators:** Uses EMA (50 & 200), MACD, and RSI to determine trend direction.
5. **Trade Execution**:
   - **BUY Signal**: If EMA crossover, MACD crossover, and RSI confirm upward momentum.
   - **SELL Signal**: If EMA crossover, MACD crossover, and RSI confirm downward momentum.
   - **Order Placement**: Places a market order with the **fixed trade amount (default $10 USDT)**.
6. **Repeating Process**:
   - The bot runs **every 60 seconds**.
   - If all trade slots are full, it focuses on **monitoring active positions instead of scanning new pairs**.

---

## Running the Bot

Run the bot using:
```bash
  node bot.js
```

or if using **PM2** for 24/7 execution:
```bash
  pm2 start bot.js --name "trading-bot"
```

To check logs:
```bash
  pm2 logs trading-bot
```

To stop the bot:
```bash
  pm2 stop trading-bot
```

---

##  Basics
If you want to adjust trading parameters, you can modify them in the **config files**:

- **`tradeExecutor.js`** → Handles trade execution and position management.
- **`trendStrategy.js`** → Defines trend-based trading logic using EMA, RSI, and MACD.
- **`bot.js`** → Main entry point; manages scanning, trade execution, and position monitoring.

---

## ⚠️ Disclaimer
This bot is for **educational purposes only**. Use at your own risk. Always test in a demo environment before deploying with real funds.

---



