import axios from 'axios';

// NewsData /crypto endpoint — returns only cryptocurrency news, no filtering needed.
// Note: free tier returns articles up to ~12h old. Paid plan gives real-time.
const NEWSDATA_CRYPTO_URL = 'https://newsdata.io/api/1/crypto';

/**
 * Map asset display names → search terms for the `q` param on /crypto.
 */
const ASSET_TO_QUERY_TERM = {
  'Bitcoin':      'bitcoin',
  'Ethereum':     'ethereum',
  'Solana':       'solana',
  'Dogecoin':     'dogecoin',
  'Cardano':      'cardano',
  'Polygon':      'polygon',
  'Binance Coin': 'binance',
  'XRP':          'XRP',
  'Litecoin':     'litecoin',
  'Avalanche':    'avalanche',
};

// 5-minute in-memory cache: { cacheKey → { timestamp, formattedNews } }
const newsCache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Build a targeted search query from the user's selected assets.
 * All articles come from the /crypto endpoint so they're always crypto-related.
 * The query further narrows to the user's specific coins when possible.
 */
function buildQuery(assets) {
  const terms = (assets || [])
    .map((a) => ASSET_TO_QUERY_TERM[a])
    .filter(Boolean)
    .slice(0, 3);          // keep the query short to avoid API limits

  if (terms.length === 0) return null; // no q param = all crypto news
  return terms.join(' OR ');
}

/**
 * Parse NewsData.io pubDate ("2024-01-15 12:30:00" UTC) to ISO string.
 */
export function parsePublishedAt(pubDateStr) {
  if (!pubDateStr) return null;
  try {
    const normalised = pubDateStr.includes('T')
      ? pubDateStr
      : `${pubDateStr.replace(' ', 'T')}Z`;
    const date = new Date(normalised);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Fetch crypto news from NewsData.io's dedicated /crypto endpoint.
 * All results are guaranteed to be crypto-related (it's a category-specific endpoint).
 * Applies a 5-minute in-memory cache keyed on the sorted asset list.
 *
 * Note on free tier: NewsData free plan returns articles up to ~12 hours old.
 * For real-time news a paid plan is required. The articles are still crypto-specific.
 *
 * @param {string[]} assets  Array of asset display names e.g. ['Bitcoin', 'Ethereum']
 * @returns {Promise<{ source: 'live'|'cache', formattedNews: Array, timestamp: string }>}
 * @throws  'NEWSDATA_API_KEY_MISSING' if the env var is absent/empty
 */
export async function fetchNewsData(assets) {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NEWSDATA_API_KEY_MISSING');
  }

  const cacheKey = [...(assets || [])].sort().join(',') || 'default';
  const now = Date.now();

  // Return cached news if still fresh
  if (newsCache[cacheKey] && now - newsCache[cacheKey].timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      formattedNews: newsCache[cacheKey].formattedNews,
      timestamp: new Date(newsCache[cacheKey].timestamp).toISOString(),
    };
  }

  const query = buildQuery(assets);

  const params = {
    apikey: apiKey,
    language: 'en',
    size: 10,
  };
  if (query) params.q = query; // add asset filter only when we have matching terms

  let response;
  try {
    response = await axios.get(NEWSDATA_CRYPTO_URL, {
      params,
      timeout: 5000,
    });
  } catch (reqErr) {
    // Log only safe info — never print the API key
    const status = reqErr.response?.status ?? 'no_response';
    const errMsg = reqErr.response?.data?.results?.message
      ?? reqErr.response?.data?.message
      ?? reqErr.message;
    console.error(`[NewsData] Request failed | status: ${status} | error: ${errMsg}`);
    throw reqErr;
  }

  const results = response.data?.results ?? [];

  if (results.length === 0) {
    console.warn('[NewsData] /crypto endpoint returned 0 results');
    throw new Error('NewsData returned no articles');
  }

  const formattedNews = results
    .filter((a) => a.title)
    .slice(0, 5)
    .map((article, i) => ({
      id: article.article_id ?? `nd-${i}-${now}`,
      title: article.title,
      summary: article.description ?? '',
      source: article.source_name ?? article.source_id ?? 'NewsData',
      url: article.link ?? null,
      publishedAt: parsePublishedAt(article.pubDate),
      tags: article.keywords ?? [],
      sentiment: 'neutral',
    }));

  // Save to cache
  newsCache[cacheKey] = { timestamp: now, formattedNews };

  const newestAt = formattedNews[0]?.publishedAt ?? 'unknown';
  console.log(`[NewsData] Fetched ${formattedNews.length} crypto articles | newest: ${newestAt}${query ? ` | query: "${query}"` : ''}`);

  return {
    source: 'live',
    formattedNews,
    timestamp: new Date(now).toISOString(),
  };
}
