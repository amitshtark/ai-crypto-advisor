import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  buildDashboardContent,
  mergeLivePricesWithFallback,
  getFallbackPricesForAssets,
} from '../services/dashboardMock.service.js';
import { fetchLivePrices } from '../services/coinGecko.service.js';
import { fetchNewsData } from '../services/newsData.service.js';
import { fetchAIInsight } from '../services/aiInsight.service.js';
import { fetchChartData, getFallbackChartData } from '../services/coinChart.service.js';
import { fetchCryptoMeme } from '../services/meme.service.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard
router.get('/', authenticateToken, async (req, res) => {
  const dashboardStartTime = Date.now();

  try {
    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      const defaultContent = buildDashboardContent(null);
      defaultContent.priceSource = 'fallback';
      defaultContent.newsSource = 'fallback';
      defaultContent.aiSource = 'fallback';
      defaultContent.aiError = 'AI insight unavailable, showing demo insight.';
      defaultContent.memeSource = 'fallback';
      defaultContent.memeError = 'Live crypto meme unavailable, showing demo crypto meme.';
      return res.json(defaultContent);
    }

    preferences.assets = JSON.parse(preferences.assets);
    preferences.contentTypes = JSON.parse(preferences.contentTypes);

    const personalizedContent = buildDashboardContent(preferences);
    // Fast response: fallback content first; live sections load via separate endpoints on the client
    personalizedContent.priceSource = 'fallback';
    personalizedContent.memeSource = preferences.contentTypes.includes('Fun') ? 'fallback' : 'skipped';

    if (preferences.contentTypes.includes('Market News')) {
      personalizedContent.newsSource = 'pending';
    } else {
      personalizedContent.newsSource = 'skipped';
      delete personalizedContent.marketNews;
      delete personalizedContent.newsError;
    }

    if (!preferences.contentTypes.includes('Fun')) {
      personalizedContent.memeSource = 'skipped';
      delete personalizedContent.meme;
      delete personalizedContent.memeError;
    }

    if (preferences.contentTypes.includes('Charts') && preferences.assets.length > 0) {
      const selectedChartAsset = preferences.assets[0];
      const fallbackChart = getFallbackChartData(selectedChartAsset);
      personalizedContent.chartData = fallbackChart.chartData;
      personalizedContent.chartSource = fallbackChart.source;
      personalizedContent.chartUpdatedAt = fallbackChart.timestamp;
      personalizedContent.selectedChartAsset = selectedChartAsset;
    } else {
      personalizedContent.chartSource = 'skipped';
    }

    // AI is fetched separately to avoid blocking the dashboard
    if (preferences.contentTypes.includes('AI Insights')) {
      // Return pending AI immediately — frontend will fetch it separately
      personalizedContent.aiSource = 'pending';
      personalizedContent.aiInsight = {
        id: 'ai-pending',
        title: 'AI Insight of the Day',
        body: 'Loading your personalized AI insight...',
        emoji: '⏳',
        confidence: 'pending',
      };
    } else {
      personalizedContent.aiSource = 'skipped';
      delete personalizedContent.aiInsight;
      delete personalizedContent.aiError;
      console.log(`[dashboard] section=ai source=skipped duration=0ms`);
    }

    const totalDuration = Date.now() - dashboardStartTime;
    console.log(`[dashboard] total_duration=${totalDuration}ms`);

    res.json(personalizedContent);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard content' });
  }
});

// GET /api/dashboard/ai
// Lightweight endpoint to fetch AI insight separately (non-blocking)
// Frontend calls this after main dashboard loads to avoid blocking
router.get('/ai', authenticateToken, async (req, res) => {
  const aiStartTime = Date.now();

  try {
    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      return res.json({
        aiSource: 'fallback',
        aiInsight: {
          id: 'ai-fallback',
          title: 'AI Insight of the Day',
          body: 'Demo insight: The crypto market is dynamic. Always research before investing.',
          emoji: '🤖',
          confidence: 'Demo',
        },
        aiError: 'Preferences not found, showing demo insight.',
      });
    }

    const assets = JSON.parse(preferences.assets);
    const contentTypes = JSON.parse(preferences.contentTypes);
    const investorType = preferences.investorType;

    if (!contentTypes.includes('AI Insights')) {
      return res.json({
        aiSource: 'skipped',
        aiError: 'AI Insights is not enabled for this user.',
      });
    }

    try {
      const aiData = await fetchAIInsight({
        assets,
        investorType,
        contentTypes,
        coinPrices: [], // Minimal context — user already has prices from dashboard
        marketNews: [],
      });

      const duration = Date.now() - aiStartTime;
      console.log(`[dashboard-ai] source=${aiData.source} duration=${duration}ms`);

      res.json({
        aiSource: aiData.source,
        aiInsight: aiData.aiInsight,
        aiUpdatedAt: aiData.timestamp,
      });
    } catch (aiErr) {
      const duration = Date.now() - aiStartTime;
      console.warn(`⚠️ [dashboard-ai] source=fallback duration=${duration}ms | error: ${aiErr.message}`);

      res.json({
        aiSource: 'fallback',
        aiInsight: {
          id: 'ai-fallback',
          title: 'AI Insight of the Day',
          body: 'Demo insight: The crypto market is dynamic. Always research before investing.',
          emoji: '🤖',
          confidence: 'Demo',
        },
        aiError: 'Live AI insight unavailable, showing demo insight.',
        aiUpdatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: 'Failed to fetch AI insight' });
  }
});

// GET /api/dashboard/news
// Lightweight route — fetches market news separately (non-blocking)
router.get('/news', authenticateToken, async (req, res) => {
  const newsStartTime = Date.now();

  try {
    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      return res.json({
        newsSource: 'fallback',
        marketNews: buildDashboardContent(null).marketNews,
        newsError: 'Preferences not found, showing demo news.',
      });
    }

    const assets = JSON.parse(preferences.assets);
    const contentTypes = JSON.parse(preferences.contentTypes);

    if (!contentTypes.includes('Market News')) {
      return res.json({
        newsSource: 'skipped',
        newsError: 'Market News is not enabled for this user.',
      });
    }

    try {
      const newsData = await fetchNewsData(assets);
      const duration = Date.now() - newsStartTime;
      console.log(`[dashboard-news] source=${newsData.source} duration=${duration}ms`);

      res.json({
        newsSource: newsData.source,
        marketNews: newsData.formattedNews,
        newsUpdatedAt: newsData.timestamp,
      });
    } catch (err) {
      const duration = Date.now() - newsStartTime;
      console.warn(`⚠️ [dashboard-news] source=fallback duration=${duration}ms | error: ${err.message}`);

      const fallbackNews = buildDashboardContent({
        assets,
        investorType: preferences.investorType,
        contentTypes,
      }).marketNews;

      res.json({
        newsSource: 'fallback',
        marketNews: fallbackNews,
        newsError: 'Live news unavailable, showing demo news.',
        newsUpdatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('News route error:', err);
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

// GET /api/dashboard/prices
// Lightweight route — only fetches coin prices for the user's current assets.
// Used by the frontend when the user adds or removes a coin so we don't have
// to reload the entire dashboard (AI + news + meme) just to update prices.
router.get('/prices', authenticateToken, async (req, res) => {
  try {
    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      return res.json({ coinPrices: [], priceSource: 'fallback' });
    }

    const assets = JSON.parse(preferences.assets);
    let coinPrices = getFallbackPricesForAssets(assets);
    let priceSource = 'fallback';
    let priceUpdatedAt = null;
    let priceError = null;

    try {
      const liveData = await fetchLivePrices(assets);
      coinPrices = mergeLivePricesWithFallback(assets, liveData?.formattedCoins);
      if (liveData?.formattedCoins?.length > 0) {
        priceSource = liveData.source;
        priceUpdatedAt = liveData.timestamp;
      }
    } catch (err) {
      priceError = 'Live prices unavailable, showing demo data.';
      console.warn(`⚠️ [dashboard-prices] source=fallback | error: ${err.message}`);
    }

    res.json({ coinPrices, priceSource, priceUpdatedAt, priceError, selectedAssets: assets });
  } catch (err) {
    console.error('Prices route error:', err);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// GET /api/dashboard/chart
// Lightweight route for changing the chart coin without reloading the dashboard
router.get('/chart', authenticateToken, async (req, res) => {
  try {
    const { asset } = req.query;
    if (!asset) {
      return res.status(400).json({ error: 'Asset parameter is required' });
    }

    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences not found' });
    }

    const assets = JSON.parse(preferences.assets);
    if (!assets.includes(asset)) {
      return res.status(403).json({ error: 'Requested asset is not tracked by the user' });
    }

    try {
      const chartDataResponse = await fetchChartData(asset);
      res.json({
        selectedAsset: asset,
        chartData: chartDataResponse.chartData,
        chartSource: chartDataResponse.source,
        chartUpdatedAt: chartDataResponse.timestamp
      });
    } catch (err) {
      console.warn(`⚠️ Chart fetch failed for ${asset}, using fallback.`, err.message);
      const fallback = getFallbackChartData(asset);
      res.json({
        selectedAsset: asset,
        chartData: fallback.chartData,
        chartSource: fallback.source,
        chartUpdatedAt: fallback.timestamp,
        chartError: 'Live chart unavailable, showing demo chart.'
      });
    }
  } catch (err) {
    console.error('Chart route error:', err);
    res.status(500).json({ error: 'Failed to fetch chart' });
  }
});

// GET /api/dashboard/meme
// Lightweight route — fetches crypto meme separately (non-blocking)
router.get('/meme', authenticateToken, async (req, res) => {
  const memeStartTime = Date.now();

  try {
    const preferences = await prisma.preference.findUnique({
      where: { userId: req.user.id },
    });

    if (!preferences) {
      return res.json({
        memeSource: 'fallback',
        meme: buildDashboardContent(null).meme,
        memeError: 'Preferences not found, showing demo meme.',
      });
    }

    const contentTypes = JSON.parse(preferences.contentTypes);

    if (!contentTypes.includes('Fun')) {
      return res.json({
        memeSource: 'skipped',
        memeError: 'Fun content is not enabled for this user.',
      });
    }

    try {
      const memeData = await fetchCryptoMeme();
      const duration = Date.now() - memeStartTime;
      console.log(`[dashboard-meme] source=${memeData.source} duration=${duration}ms`);

      res.json({
        memeSource: memeData.source,
        meme: memeData.meme,
        memeUpdatedAt: memeData.timestamp,
      });
    } catch (err) {
      const duration = Date.now() - memeStartTime;
      console.warn(`⚠️ [dashboard-meme] source=fallback duration=${duration}ms | error: ${err.message}`);

      res.json({
        memeSource: 'fallback',
        meme: buildDashboardContent({
          assets: JSON.parse(preferences.assets),
          investorType: preferences.investorType,
          contentTypes,
        }).meme,
        memeError: 'Live crypto meme unavailable, showing demo meme.',
        memeUpdatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Meme route error:', err);
    res.status(500).json({ error: 'Failed to fetch crypto meme' });
  }
});

export default router;
