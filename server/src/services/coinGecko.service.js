import axios from 'axios';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

const ASSET_TO_ID_MAP = {
  'Bitcoin':      'bitcoin',
  'Ethereum':     'ethereum',
  'Solana':       'solana',
  'Dogecoin':     'dogecoin',
  'Cardano':      'cardano',
  'Polygon':      'polygon-ecosystem-token',  // was 'polygon' which returns no data
  'Binance Coin': 'binancecoin',
  'XRP':          'ripple',
  'Litecoin':     'litecoin',
  'Avalanche':    'avalanche-2',
};

// Fallback icons and colors since CoinGecko simple price doesn't return them
const ASSET_META = {
  'Bitcoin': { icon: '₿', color: '#F7931A', symbol: 'BTC' },
  'Ethereum': { icon: 'Ξ', color: '#627EEA', symbol: 'ETH' },
  'Solana': { icon: '◎', color: '#9945FF', symbol: 'SOL' },
  'Dogecoin': { icon: 'Ð', color: '#C2A633', symbol: 'DOGE' },
  'Cardano': { icon: '₳', color: '#0D1E2D', symbol: 'ADA' },
  'Polygon': { icon: '⬡', color: '#8247E5', symbol: 'MATIC' },
  'Binance Coin': { icon: 'BNB', color: '#F3BA2F', symbol: 'BNB' },
  'XRP': { icon: '✕', color: '#23292F', symbol: 'XRP' },
  'Litecoin': { icon: 'Ł', color: '#345D9D', symbol: 'LTC' },
  'Avalanche': { icon: '🔺', color: '#E84142', symbol: 'AVAX' },
};

// In-memory cache: { "bitcoin,ethereum": { timestamp: 123456789, formattedCoins: [...] } }
const priceCache = {};
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

/**
 * Fetch live prices for selected assets from CoinGecko, with caching.
 * @param {string[]} assets Array of asset names (e.g. ['Bitcoin', 'Ethereum'])
 * @returns {Promise<{ source: string, formattedCoins: Array, timestamp: string }>} 
 */
export async function fetchLivePrices(assets) {
  if (!assets || assets.length === 0) return { source: 'live', formattedCoins: [], timestamp: new Date().toISOString() };

  const ids = assets.map(asset => ASSET_TO_ID_MAP[asset]).filter(Boolean);
  if (ids.length === 0) return { source: 'live', formattedCoins: [], timestamp: new Date().toISOString() };

  // Sort IDs so the cache key is consistent regardless of order
  const cacheKey = [...ids].sort().join(',');
  const now = Date.now();

  if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      formattedCoins: priceCache[cacheKey].formattedCoins,
      timestamp: new Date(priceCache[cacheKey].timestamp).toISOString(),
    };
  }

  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    // Map the response back to our frontend format
    const formattedCoins = assets.map(asset => {
      const id = ASSET_TO_ID_MAP[asset];
      const coinData = data[id];
      const meta = ASSET_META[asset] || { icon: '?', color: '#ccc', symbol: asset.substring(0, 3).toUpperCase() };

      if (!coinData) {
        return null; // Handle case where an asset might be missing from response
      }

      return {
        id,
        name: asset,
        symbol: meta.symbol,
        price: coinData.usd,
        change24h: coinData.usd_24h_change,
        marketCap: formatMarketCap(coinData.usd_market_cap),
        icon: meta.icon,
        color: meta.color,
      };
    }).filter(Boolean); // Remove any nulls

    // Save to cache
    priceCache[cacheKey] = {
      timestamp: now,
      formattedCoins,
    };

    return {
      source: 'live',
      formattedCoins,
      timestamp: new Date(now).toISOString(),
    };
  } catch (error) {
    console.error('CoinGecko API Error:', error.message);
    throw new Error('Failed to fetch live prices from CoinGecko');
  }
}

function formatMarketCap(num) {
  if (!num) return 'N/A';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  return num.toString();
}
