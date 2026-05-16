import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { buildDashboardContent } from '../services/dashboardMock.service.js';
import { fetchLivePrices } from '../services/coinGecko.service.js';
import { fetchNewsData } from '../services/newsData.service.js';
import { fetchAIInsight } from '../services/aiInsight.service.js';
import { fetchCryptoMeme } from '../services/meme.service.js';
import { fetchChartData, getFallbackChartData } from '../services/coinChart.service.js';

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
    personalizedContent.priceSource = 'fallback'; // Default until live/cache succeeds
    personalizedContent.newsSource = 'fallback';  // Default until live/cache succeeds
    personalizedContent.aiSource = 'fallback';    // Default until live/cache succeeds
    personalizedContent.memeSource = 'fallback';  // Default until live/cache succeeds
    personalizedContent.chartSource = 'fallback'; // Default until live/cache succeeds

    // ── PHASE 1: Run independent API calls in parallel ─────────────────────────
    // Prices always fetches; news, meme, chart only if user selected them
    
    const parallelStartTime = Date.now();
    
    const parallelTasks = [
      // Always fetch prices
      (async () => {
        const taskStart = Date.now();
        try {
          const liveData = await fetchLivePrices(preferences.assets);
          if (liveData && liveData.formattedCoins.length > 0) {
            personalizedContent.coinPrices = liveData.formattedCoins;
            personalizedContent.priceSource = liveData.source;
            personalizedContent.priceUpdatedAt = liveData.timestamp;
          }
          const duration = Date.now() - taskStart;
          console.log(`[dashboard] section=prices source=${personalizedContent.priceSource} duration=${duration}ms`);
        } catch (err) {
          const duration = Date.now() - taskStart;
          console.warn(`⚠️ [dashboard] section=prices source=fallback duration=${duration}ms | error: ${err.message}`);
          personalizedContent.priceError = 'Live prices unavailable, showing demo data.';
        }
      })(),
    ];

    // Fetch news only if selected
    if (preferences.contentTypes.includes('Market News')) {
      parallelTasks.push(
        (async () => {
          const taskStart = Date.now();
          try {
            const newsData = await fetchNewsData(preferences.assets);
            if (newsData && newsData.formattedNews.length > 0) {
              personalizedContent.marketNews = newsData.formattedNews;
              personalizedContent.newsSource = newsData.source;
              personalizedContent.newsUpdatedAt = newsData.timestamp;
            }
            const duration = Date.now() - taskStart;
            console.log(`[dashboard] section=news source=${personalizedContent.newsSource} duration=${duration}ms`);
          } catch (err) {
            const duration = Date.now() - taskStart;
            console.warn(`⚠️ [dashboard] section=news source=fallback duration=${duration}ms | error: ${err.message}`);
            personalizedContent.newsError = 'Live news unavailable, showing demo news.';
          }
        })()
      );
    } else {
      personalizedContent.newsSource = 'skipped';
      delete personalizedContent.marketNews;
      delete personalizedContent.newsError;
      console.log(`[dashboard] section=news source=skipped duration=0ms`);
    }

    // Fetch meme only if selected
    if (preferences.contentTypes.includes('Fun')) {
      parallelTasks.push(
        (async () => {
          const taskStart = Date.now();
          try {
            const memeData = await fetchCryptoMeme();
            personalizedContent.meme = memeData.meme;
            personalizedContent.memeSource = memeData.source;
            personalizedContent.memeUpdatedAt = memeData.timestamp;
            const duration = Date.now() - taskStart;
            console.log(`[dashboard] section=meme source=${personalizedContent.memeSource} duration=${duration}ms`);
          } catch (err) {
            const duration = Date.now() - taskStart;
            console.warn(`⚠️ [dashboard] section=meme source=fallback duration=${duration}ms | error: ${err.message}`);
            personalizedContent.memeError = 'Live crypto meme unavailable, showing demo crypto meme.';
          }
        })()
      );
    } else {
      personalizedContent.memeSource = 'skipped';
      delete personalizedContent.meme;
      delete personalizedContent.memeError;
      console.log(`[dashboard] section=meme source=skipped duration=0ms`);
    }

    // Fetch chart only if selected
    if (preferences.contentTypes.includes('Charts') && preferences.assets.length > 0) {
      const selectedChartAsset = preferences.assets[0];
      parallelTasks.push(
        (async () => {
          const taskStart = Date.now();
          try {
            const chartDataResponse = await fetchChartData(selectedChartAsset);
            personalizedContent.chartData = chartDataResponse.chartData;
            personalizedContent.chartSource = chartDataResponse.source;
            personalizedContent.chartUpdatedAt = chartDataResponse.timestamp;
            personalizedContent.selectedChartAsset = selectedChartAsset;
            const duration = Date.now() - taskStart;
            console.log(`[dashboard] section=chart source=${personalizedContent.chartSource} duration=${duration}ms`);
          } catch (err) {
            const duration = Date.now() - taskStart;
            console.warn(`⚠️ [dashboard] section=chart source=fallback duration=${duration}ms | error: ${err.message}`);
            const fallback = getFallbackChartData(selectedChartAsset);
            personalizedContent.chartData = fallback.chartData;
            personalizedContent.chartSource = fallback.source;
            personalizedContent.chartUpdatedAt = fallback.timestamp;
            personalizedContent.selectedChartAsset = selectedChartAsset;
            personalizedContent.chartError = 'Live chart unavailable, showing demo chart.';
          }
        })()
      );
    } else {
      personalizedContent.chartSource = 'skipped';
      console.log(`[dashboard] section=chart source=skipped duration=0ms`);
    }

    // Run all parallel tasks — each handles its own error
    await Promise.allSettled(parallelTasks);
    
    const parallelDuration = Date.now() - parallelStartTime;
    console.log(`[dashboard] parallel_phase completed in ${parallelDuration}ms`);

    // ── PHASE 2: Fetch AI ONLY if selected (uses prices + news from Phase 1) ──
    // AI is now fetched separately to avoid blocking the dashboard
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
    let coinPrices = [];
    let priceSource = 'fallback';
    let priceUpdatedAt = null;

    try {
      const liveData = await fetchLivePrices(assets);
      if (liveData && liveData.formattedCoins.length > 0) {
        coinPrices = liveData.formattedCoins;
        priceSource = liveData.source;
        priceUpdatedAt = liveData.timestamp;
      }
    } catch {
      // fallback — return empty so frontend keeps existing mock prices
    }

    res.json({ coinPrices, priceSource, priceUpdatedAt, selectedAssets: assets });
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

export default router;
