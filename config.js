require('dotenv').config();

module.exports = {
    exchange: 'bybit',
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET,
    testnet: false, // Change to true for Testnet
    type: 'spot' // Use 'spot' for Spot trading, 'future' for Derivatives
};
