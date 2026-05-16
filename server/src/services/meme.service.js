import axios from 'axios';

/**
 * Crypto-specific meme endpoints in priority order.
 * We only use subreddits dedicated to crypto — never a general meme subreddit.
 */
const CRYPTO_MEME_ENDPOINTS = [
  'https://meme-api.com/gimme/cryptocurrencymemes',
  'https://meme-api.com/gimme/Bitcoin',
  'https://meme-api.com/gimme/ethereum',
];

const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// 60-second in-memory cache (single slot — one meme at a time is enough)
const memeCache = { data: null, timestamp: 0 };
const CACHE_DURATION_MS = 60 * 1000;

/**
 * Checks if a URL looks like a direct image link.
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0]; // strip query params before checking extension
  return VALID_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Extracts the best image URL from a meme-api post.
 * Prefers the direct post URL; falls back to the highest-resolution preview.
 */
function extractImageUrl(post) {
  if (isValidImageUrl(post.url)) return post.url;

  // preview[] is sorted low → high resolution by meme-api
  if (Array.isArray(post.preview) && post.preview.length > 0) {
    const best = post.preview[post.preview.length - 1];
    if (isValidImageUrl(best)) return best;
  }

  return null;
}

/**
 * Validates that a meme-api response post is safe and usable.
 */
function isUsable(post) {
  if (!post || typeof post !== 'object') return false;
  if (post.nsfw) return false;
  if (post.spoiler) return false;
  if (!post.title || typeof post.title !== 'string') return false;
  if (!extractImageUrl(post)) return false; // must have a displayable image
  return true;
}

/**
 * Fetch a live crypto meme from meme-api.com.
 * Tries each crypto-specific endpoint in order; never uses a general meme subreddit.
 * If all fail or return unusable content, throws so the caller can use the static fallback.
 *
 * @returns {Promise<{ source: 'live'|'cache', meme: object, timestamp: string }>}
 */
export async function fetchCryptoMeme() {
  const now = Date.now();

  // Return cached meme if still fresh
  if (memeCache.data && now - memeCache.timestamp < CACHE_DURATION_MS) {
    return {
      source: 'cache',
      meme: memeCache.data,
      timestamp: new Date(memeCache.timestamp).toISOString(),
    };
  }

  // Try each crypto-specific endpoint in order
  for (const endpoint of CRYPTO_MEME_ENDPOINTS) {
    try {
      const response = await axios.get(endpoint, { timeout: 5000 });
      const post = response.data;

      if (!isUsable(post)) {
        console.warn(
          `[Meme] Skipping unusable post from ${endpoint} ` +
          `| nsfw=${post?.nsfw} spoiler=${post?.spoiler} hasTitle=${!!post?.title} hasImage=${!!extractImageUrl(post)}`
        );
        continue; // try next endpoint
      }

      const imageUrl = extractImageUrl(post);

      const meme = {
        id: `live-${post.postLink?.split('/').pop() ?? now}`,
        title: post.title,
        imageUrl,
        source: post.author ? `u/${post.author}` : post.subreddit,
        url: post.postLink ?? null,
        subreddit: post.subreddit ?? null,
      };

      // Cache the result
      memeCache.data = meme;
      memeCache.timestamp = now;

      console.log(`[Meme] Fetched live crypto meme from r/${post.subreddit} | "${post.title.substring(0, 60)}"`);

      return {
        source: 'live',
        meme,
        timestamp: new Date(now).toISOString(),
      };
    } catch (err) {
      const status = err.response?.status ?? 'no_response';
      console.warn(`[Meme] Failed to fetch from ${endpoint} | status: ${status} | error: ${err.message}`);
      // continue to next endpoint
    }
  }

  // All crypto endpoints failed or returned unusable content
  throw new Error('ALL_CRYPTO_MEME_ENDPOINTS_FAILED');
}
