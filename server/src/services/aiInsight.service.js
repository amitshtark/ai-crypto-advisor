import axios from 'axios';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Model is configurable via OPENROUTER_MODEL env var.
// Always default to an explicit free model (":free" suffix = $0 quota on OpenRouter).
// Do NOT use openrouter/auto — that router may select paid models.
// Confirmed-free alternatives (as of 2026-05):
//   meta-llama/llama-3.3-70b-instruct:free  (may be rate-limited during peak hours)
//   meta-llama/llama-3.2-3b-instruct:free
//   google/gemma-4-31b-it:free
const getModel = () => process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash:free';

// 6-hour in-memory cache: { cacheKey: { timestamp, aiInsight } }
const aiCache = {};
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Build a stable, human-readable cache key that represents the user's
 * context and approximate market state. Using a price bucket (nearest $5k for BTC)
 * prevents re-generating the insight on every tiny price tick while still
 * refreshing when the market moves meaningfully.
 */
function buildCacheKey(assets, investorType, contentTypes, coinPrices) {
  const assetStr = [...assets].sort().join(',');
  const contentStr = [...contentTypes].sort().join(',');

  // Bucket BTC price by $5k intervals as a simple "market context" signal
  const btcCoin = coinPrices?.find((c) => c.name === 'Bitcoin');
  const marketBucket = btcCoin
    ? `btc_${Math.floor(btcCoin.price / 5000)}`
    : 'no_btc';

  return `${assetStr}|${investorType}|${contentStr}|${marketBucket}`;
}

/**
 * Build the prompt sent to OpenRouter.
 * The tone is adapted to the investor type; prices and news headlines
 * are injected as lightweight market context.
 */
function buildPrompt(assets, investorType, contentTypes, coinPrices, marketNews) {
  const assetList = assets.join(', ');

  const priceContext =
    coinPrices && coinPrices.length > 0
      ? coinPrices
          .slice(0, 3)
          .map(
            (c) =>
              `${c.name}: $${Number(c.price).toLocaleString('en-US', { maximumFractionDigits: 2 })} ` +
              `(${c.change24h >= 0 ? '+' : ''}${Number(c.change24h).toFixed(2)}% 24h)`
          )
          .join(', ')
      : 'prices unavailable';

  const newsContext =
    marketNews && marketNews.length > 0
      ? marketNews
          .slice(0, 2)
          .map((n) => n.title)
          .join('; ')
      : 'no recent news';

  const toneGuide = {
    HODLer:
      'Write from a long-term perspective. Focus on fundamentals, patience, and accumulation over time.',
    'Day Trader':
      'Write from a short-term trading perspective. Highlight volatility, momentum, and market timing.',
    'NFT Collector':
      'Write from an ecosystem and community angle. Connect market conditions to NFT trends, liquidity, and social signals.',
    'DeFi Explorer':
      'Write from a DeFi perspective. Focus on protocol risk, yield opportunities, and on-chain activity.',
    Beginner:
      'Write in very simple language. Avoid jargon. Briefly explain what is happening and why it matters.',
  };

  const tone = toneGuide[investorType] || toneGuide['HODLer'];

  return `You are a crypto market educator writing a short daily insight for a personal dashboard app.

User profile:
- Investor type: ${investorType}
- Tracked assets: ${assetList}
- Content interests: ${contentTypes.join(', ')}

Current market snapshot:
- Prices: ${priceContext}
- Recent headlines: ${newsContext}

Write a short educational crypto insight (under 120 words) for this user.

Rules:
- This is EDUCATIONAL ONLY. Do NOT give financial advice or recommend buying/selling.
- ${tone}
- Mention ONE specific risk the user should be aware of right now.
- Write in a direct, clear, and engaging tone.
- Do NOT include any prefixes like "Insight:", "Here is your insight:", or disclaimers — start directly with the insight text.`;
}

/**
 * Fetch a personalized AI insight from OpenRouter.
 * Returns { source: 'live'|'cache', aiInsight, timestamp }.
 * Throws if the API key is missing or the request fails — callers should catch and fall back.
 *
 * @param {{ assets: string[], investorType: string, contentTypes: string[], coinPrices: Array, marketNews: Array }} params
 */
export async function fetchAIInsight({ assets, investorType, contentTypes, coinPrices, marketNews }) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OPENROUTER_API_KEY_MISSING');
  }

  const cacheKey = buildCacheKey(assets, investorType, contentTypes, coinPrices);
  const now = Date.now();

  // Return cached insight if still fresh
  if (aiCache[cacheKey] && now - aiCache[cacheKey].timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      aiInsight: aiCache[cacheKey].aiInsight,
      timestamp: new Date(aiCache[cacheKey].timestamp).toISOString(),
    };
  }

  const prompt = buildPrompt(assets, investorType, contentTypes, coinPrices, marketNews);
  const model = getModel();

  let response;
  try {
    response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-crypto-advisor.app',
          'X-Title': 'AI Crypto Advisor',
        },
        timeout: 8000, // 8 seconds — free tier can be slow but 20s was too long
      }
    );
  } catch (reqErr) {
    // Safe debug logging — key is never printed
    const status = reqErr.response?.status ?? 'no_response';
    const errMsg = reqErr.response?.data?.error?.message ?? reqErr.message;
    console.error(`[OpenRouter] Request failed | model: ${model} | status: ${status} | error: ${errMsg}`);
    throw reqErr;
  }

  // Log response metadata for safe debugging
  const usedModel = response.data?.model ?? model;
  console.log(`[OpenRouter] Response received | model: ${usedModel} | status: ${response.status}`);

  const content = response.data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    console.error(`[OpenRouter] Empty content in response | model: ${usedModel}`);
    throw new Error('OpenRouter returned an empty response');
  }

  const aiInsight = {
    id: `ai-live-${now}`,
    title: 'AI Insight of the Day',
    body: content,
    emoji: '🤖',
    confidence: 'AI-generated',
  };

  // Save to cache
  aiCache[cacheKey] = {
    timestamp: now,
    aiInsight,
  };

  return {
    source: 'live',
    aiInsight,
    timestamp: new Date(now).toISOString(),
  };
}
