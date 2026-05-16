import axios from 'axios';

const CRYPTOPANIC_BASE_URL = 'https://cryptopanic.com/api/v1/posts/';

// Map our full asset names to the standard ticker symbols CryptoPanic expects
const ASSET_TO_SYMBOL_MAP = {
  'Bitcoin': 'BTC',
  'Ethereum': 'ETH',
  'Solana': 'SOL',
  'Dogecoin': 'DOGE',
  'Cardano': 'ADA',
  'Polygon': 'MATIC',
  'Binance Coin': 'BNB',
  'XRP': 'XRP',
  'Litecoin': 'LTC',
  'Avalanche': 'AVAX',
};

// In-memory cache: { "BTC,ETH": { timestamp: 123456789, formattedNews: [...] } }
const newsCache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch live news for selected assets from CryptoPanic.
 * @param {string[]} assets Array of asset names (e.g. ['Bitcoin', 'Ethereum'])
 * @returns {Promise<{ source: string, formattedNews: Array, timestamp: string }>} 
 */
export async function fetchLiveNews(assets) {
  const apiKey = process.env.CRYPTOPANIC_API_KEY;

  if (!apiKey) {
    throw new Error('CRYPTOPANIC_API_KEY_MISSING');
  }

  if (!assets || assets.length === 0) {
    return { source: 'live', formattedNews: [], timestamp: new Date().toISOString() };
  }

  const symbols = assets.map(asset => ASSET_TO_SYMBOL_MAP[asset]).filter(Boolean);
  if (symbols.length === 0) {
    return { source: 'live', formattedNews: [], timestamp: new Date().toISOString() };
  }

  // Sort symbols to maintain consistent cache key
  const cacheKey = [...symbols].sort().join(',');
  const now = Date.now();

  // Check cache
  if (newsCache[cacheKey] && now - newsCache[cacheKey].timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      formattedNews: newsCache[cacheKey].formattedNews,
      timestamp: new Date(newsCache[cacheKey].timestamp).toISOString(),
    };
  }

  // Build the URL, joining up to 50 currencies
  const url = `${CRYPTOPANIC_BASE_URL}?auth_token=${apiKey}&currencies=${symbols.join(',')}&filter=important`;

  try {
    const response = await axios.get(url, { timeout: 8000 }); // Give it slightly longer as CryptoPanic can be slow
    const results = response.data.results || [];

    // Map to our dashboard mock format
    const formattedNews = results.map(post => {
      // CryptoPanic returns an ISO created_at string
      const date = new Date(post.created_at);
      const timeString = formatRelativeTime(date);

      return {
        id: `cp-${post.id}`,
        title: post.title,
        summary: '', // CryptoPanic API free tier doesn't return full body snippets reliably, use title/empty
        source: post.source?.title || post.domain || 'CryptoPanic',
        url: post.url,
        time: timeString,
        tags: post.currencies ? post.currencies.map(c => c.code) : [],
        sentiment: post.votes?.positive > post.votes?.negative ? 'bullish' : 'neutral',
      };
    });

    // Save to cache
    newsCache[cacheKey] = {
      timestamp: now,
      formattedNews,
    };

    return {
      source: 'live',
      formattedNews,
      timestamp: new Date(now).toISOString(),
    };
  } catch (error) {
    console.error('CryptoPanic API Error:', error.message);
    throw new Error('Failed to fetch live news from CryptoPanic');
  }
}

// Simple relative time formatter (e.g. "2h ago", "1d ago")
function formatRelativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
