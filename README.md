# WTF IS THAT

Well made this bot cause I was tired of getting rekt by garbage signals and overleverage. So I told myself, why I'm not getting rekt by something I did? And here we are. It trades BTC, ETH, SOL and other actual coins (none of that low cap BS) on Bybit futures. Uses legit TA and doesn't ape in like a degen.

# WTF IT DOES

- Only trades real coins cause shitcoins will rek you
- Uses proper TA (EMAs, RSI, MACD, ADX) to catch trends
- Spots legit support/resistance levels
- Smart scoring system that isn't total BS
- Position sizing that won't blow up your account (2% risk per trade)
- Leverage that makes sense (1-5x max, no 100x degen stuff)
- Risk management that'll keep you alive:
  - Max 4 positions open
  - Takes profit at given PnL
  - Cuts losses at given PnL
  - One trade per pair (don't get greedy)

## How It Actually Works

### The TA Part
- EMA crossovers (50/200 - yeah basic but works)
- MACD (when it actually crosses, not that fake stuff)
- RSI: 
  - Oversold (<30): Strong buy signal (+2)
  - Overbought (>70): Strong sell signal (-2)
  - Above 50: Bullish (+1)
  - Below 50: Bearish (-1)
- ADX above 20 (no choppy market BS)

### Market Stuff That Matters
- Need decent volume
- Spread can't be garbage
- S/R levels that aren't just random lines

### The Scoring System

Bot scores trades from -15 to +15. Here's the juice:

Volume Points (±4):
- Under 100k = nah fam (dead market)
- 100k-500k = ±1 (decent)
- 500k-2M = ±2 (now we're talking)
- 2M-5M = ±3 (getting spicy)
- 5M+ = ±4 (absolute unit)

Spread Points (±1):
- Under 0.1% = ±1
- Over = nah

S/R Points (±3):
- Stronger levels = better score
- Closer = better score
- Strong nearby support = +3 for longs
- Strong nearby resistance = -3 for shorts

Technical Points (±6):
- EMA crossover = ±2
- MACD cross + trend = ±2
- RSI signals = ±2

Won't Trade When:
- Market's being weird between S/R
- Range is too tight with strong levels
- Score too weak (need conviction fam)

### Real Examples

Perfect Long Setup (+15):
```json
{
    "volumeScore": "+4",    // monster volume
    "spreadScore": "+1",    // clean spread
    "supportScore": "+3",   // solid support
    "technicalScore": "+6", // all systems go
    "trendScore": "+1",     // trending nicely
    "total": "+15"         // chef's kiss
}
```

Perfect Short Setup (-15):
```json
{
    "volumeScore": "-4",    // massive volume
    "spreadScore": "-1",    // tight spread
    "resistanceScore": "-3", // brick wall above
    "technicalScore": "-6",  // everything bearish
    "trendScore": "-1",     // dumping hard
    "total": "-15"         // short it
}
```

Bot only trades when:
- Longs: Above +9 (need that conviction)
- Shorts: Below -9 (same deal)
Higher score = stronger setup = more likely to print

## Setting It Up

1. Clone it:
```bash
git clone https://github.com/efeDaniels/fun.git
cd trading-bot
```

2. Install stuff:
```bash
npm install
```

3. Set up your keys:
Make a .env file:
```plaintext
API_KEY=your_bybit_api_key
API_SECRET=your_bybit_api_secret
```

Get API keys from Bybit's site

## What It Trades

Sticks to coins that actually matter:
- BTC/USDT
- ETH/USDT
- SOL/USDT
- BNB/USDT
- XRP/USDT
- AVAX/USDT
- MATIC/USDT
- Other major pairs that aren't trash

## Running It

Basic start:
```bash
node bot.js
```

For running 24/7 (use PM2):
```bash
pm2 start bot.js --name "trading-bot"
```

Check what it's doing:
```bash
pm2 logs trading-bot
```

Kill it:
```bash
pm2 stop trading-bot
```

## Important Files
- `bot.js`: Main stuff
- `trendStrategy.js`: TA logic
- `tradeExecutor.js`: Handles orders
- `support_resistance.js`: Finds S/R levels

## Gang Shit No Lame Shit

Look, this bot works but trading's still risky af. Some real talk:
- Test it first
- Start small
- Don't trade money you need
- Watch it like a hawk
- Past trades don't mean shit for future ones
- This shit only loses, don't expect any profits

Made this for learning - don't blame me if you blow up your account being dumb. Hawkkk Tuaaah!