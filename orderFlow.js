const WebSocket = require('ws');

function analyzeOrderFlow(pair) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`wss://stream.bybit.com/realtime_public`);
        
        ws.on('open', () => {
            ws.send(JSON.stringify({ op: 'subscribe', args: [`orderBookL2_25.${pair.replace('/', '')}`] }));
        });

        ws.on('message', (data) => {
            try {
                const orderBook = JSON.parse(data);
                if (orderBook && orderBook.data) {
                    const bids = orderBook.data.filter(order => order.side === 'Buy')
                        .reduce((sum, order) => sum + order.size, 0);
                    const asks = orderBook.data.filter(order => order.side === 'Sell')
                        .reduce((sum, order) => sum + order.size, 0);

                    resolve({ bids, asks });
                    ws.close();
                }
            } catch (err) {
                reject(err);
            }
        });

        ws.on('error', (err) => reject(err));
    });
}

module.exports = { analyzeOrderFlow };
