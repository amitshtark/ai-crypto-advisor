import axios from 'axios';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Matches coinGecko.service.js
const ASSET_TO_ID_MAP = {
  'Bitcoin':      'bitcoin',
  'Ethereum':     'ethereum',
  'Solana':       'solana',
  'Dogecoin':     'dogecoin',
  'Cardano':      'cardano',
  'Polygon':      'polygon-ecosystem-token',
  'Binance Coin': 'binancecoin',
  'XRP':          'ripple',
  'Litecoin':     'litecoin',
  'Avalanche':    'avalanche-2',
};

// In-memory cache: { "bitcoin_7": { timestamp: 123456789, chartData: [...] } }
const chartCache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch historical chart data for a selected asset from CoinGecko, with caching.
 * @param {string} asset Asset name (e.g. 'Bitcoin')
 * @param {number} days Number of days of historical data (default 7)
 * @returns {Promise<{ source: string, chartData: Array, timestamp: string }>} 
 */
export async function fetchChartData(asset, days = 7) {
  if (!asset) {
    throw new Error('No asset provided for chart fetch');
  }

  const coinId = ASSET_TO_ID_MAP[asset];
  if (!coinId) {
    throw new Error(`Unknown asset for chart: ${asset}`);
  }

  const cacheKey = `${coinId}_${days}`;
  const now = Date.now();

  if (chartCache[cacheKey] && now - chartCache[cacheKey].timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      chartData: chartCache[cacheKey].chartData,
      timestamp: new Date(chartCache[cacheKey].timestamp).toISOString(),
    };
  }

  try {
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    const response = await axios.get(url, { timeout: 5000 });
    
    // response.data.prices is an array of [timestamp, price]
    if (!response.data || !response.data.prices || response.data.prices.length === 0) {
      throw new Error(`Invalid chart data format received for ${asset}`);
    }

    const chartData = response.data.prices.map(([timestamp, price]) => {
      const date = new Date(timestamp);
      // Format to e.g., "May 10, 14:00" for display on X-axis
      const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      return {
        time: timeStr,
        price: Number(price.toFixed(2)) // Keep it clean for the chart
      };
    });

    chartCache[cacheKey] = {
      timestamp: now,
      chartData,
    };

    return {
      source: 'live',
      chartData,
      timestamp: new Date(now).toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching chart for ${asset}:`, error.message);
    throw error;
  }
}

/**
 * Returns static fallback chart data if the API is down
 */
export function getFallbackChartData(asset) {
  // Generate some realistic-looking sine wave demo data
  const chartData = [];
  const basePrice = asset === 'Bitcoin' ? 60000 : asset === 'Ethereum' ? 3000 : 100;
  const now = Date.now();
  
  for (let i = 0; i <= 24; i++) { // Generate 24 points
    const ts = now - (24 - i) * 60 * 60 * 1000;
    const date = new Date(ts);
    const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Add a bit of random variation
    const variation = Math.sin(i / 3) * (basePrice * 0.05) + (Math.random() * basePrice * 0.02);
    
    chartData.push({
      time: timeStr,
      price: Number((basePrice + variation).toFixed(2))
    });
  }

  return {
    source: 'fallback',
    chartData,
    timestamp: new Date().toISOString(),
  };
}
