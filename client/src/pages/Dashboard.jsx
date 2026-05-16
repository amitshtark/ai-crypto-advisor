import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import DashboardCard from '../components/DashboardCard';
import { LogOut, User, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatNewsTime(publishedAt) {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return null;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function CardSkeleton({ lines = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 18 : 14,
            borderRadius: 4,
            backgroundColor: 'var(--border)',
            opacity: 0.45,
          }}
        />
      ))}
    </div>
  );
}

const ALL_AVAILABLE_COINS = [
  'Bitcoin', 'Ethereum', 'Solana', 'Dogecoin', 'Cardano', 
  'Polygon', 'Binance Coin', 'XRP', 'Litecoin', 'Avalanche'
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editMode, setEditMode] = useState(false);
  const [savingCoins, setSavingCoins] = useState(false);
  const [selectedCoinToAdd, setSelectedCoinToAdd] = useState('');
  const [chartLoading, setChartLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState({
    prices: false,
    news: false,
    chart: false,
    meme: false,
  });
  const sectionsHydratedRef = useRef(false);
  
  // Retry tracking: { section: { count, timerId } }
  const retryCountersRef = useRef({ news: 0, ai: 0, chart: 0, meme: 0 });
  const retryTimersRef = useRef({ news: null, ai: null, chart: null, meme: null });
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 30000; // 30 seconds

  const fetchDashboard = async () => {
    try {
      const dashboardData = await api.getDashboard();
      setData(dashboardData);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup retry timers on unmount
  useEffect(() => {
    return () => {
      Object.values(retryTimersRef.current).forEach(timerId => {
        if (timerId) clearTimeout(timerId);
      });
    };
  }, []);

  // Fetch AI insight separately (non-blocking) if selected
  const fetchAIInsight = async () => {
    if (!data || !data.meta?.contentTypes?.includes('AI Insights')) return;

    try {
      const aiData = await api.getAIInsight();
      setData((prev) => ({
        ...prev,
        aiSource: aiData.aiSource,
        aiInsight: aiData.aiInsight,
        aiUpdatedAt: aiData.aiUpdatedAt,
        aiError: aiData.aiError,
      }));
      // Reset retry counter on success
      if (aiData.aiSource === 'live' || aiData.aiSource === 'cache') {
        retryCountersRef.current.ai = 0;
      }
    } catch (err) {
      console.error('Failed to fetch AI insight:', err);
      // Keep the pending state if fetch fails
    }
  };

  // Retry handler for AI — retries only the AI endpoint
  const scheduleAIRetry = () => {
    if (retryCountersRef.current.ai >= MAX_RETRIES) return;
    if (retryTimersRef.current.ai) clearTimeout(retryTimersRef.current.ai);
    
    retryCountersRef.current.ai += 1;
    retryTimersRef.current.ai = setTimeout(() => {
      console.log(`[Retry] AI attempt ${retryCountersRef.current.ai}/${MAX_RETRIES}`);
      fetchAIInsight();
    }, RETRY_DELAY_MS);
  };

  // Retry handler for News
  const fetchNewsWithRetry = async () => {
    if (!data?.meta?.contentTypes?.includes('Market News')) return;
    
    try {
      const newsData = await api.getNews();
      setData((prev) => ({
        ...prev,
        marketNews: newsData.marketNews ?? prev.marketNews,
        newsSource: newsData.newsSource ?? prev.newsSource,
        newsUpdatedAt: newsData.newsUpdatedAt,
        newsError: newsData.newsError ?? null,
      }));
      // Reset retry counter on success
      if (newsData.newsSource === 'live' || newsData.newsSource === 'cache') {
        retryCountersRef.current.news = 0;
      } else if (newsData.newsSource === 'fallback') {
        scheduleNewsRetry();
      }
    } catch (err) {
      console.error('Failed to fetch market news:', err);
      scheduleNewsRetry();
    }
  };

  const scheduleNewsRetry = () => {
    if (retryCountersRef.current.news >= MAX_RETRIES) return;
    if (retryTimersRef.current.news) clearTimeout(retryTimersRef.current.news);
    
    retryCountersRef.current.news += 1;
    retryTimersRef.current.news = setTimeout(() => {
      console.log(`[Retry] News attempt ${retryCountersRef.current.news}/${MAX_RETRIES}`);
      fetchNewsWithRetry();
    }, RETRY_DELAY_MS);
  };

  // Retry handler for Chart
  const fetchChartWithRetry = async (asset) => {
    try {
      const chartRes = await api.getChart(asset);
      setData((prev) => ({
        ...prev,
        selectedChartAsset: chartRes.selectedAsset,
        chartData: chartRes.chartData,
        chartSource: chartRes.chartSource,
        chartUpdatedAt: chartRes.chartUpdatedAt,
        chartError: chartRes.chartError
      }));
      // Reset retry counter on success
      if (chartRes.chartSource === 'live' || chartRes.chartSource === 'cache') {
        retryCountersRef.current.chart = 0;
      } else if (chartRes.chartSource === 'fallback') {
        scheduleChartRetry(asset);
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      scheduleChartRetry(asset);
    }
  };

  const scheduleChartRetry = (asset) => {
    if (retryCountersRef.current.chart >= MAX_RETRIES) return;
    if (retryTimersRef.current.chart) clearTimeout(retryTimersRef.current.chart);
    
    retryCountersRef.current.chart += 1;
    retryTimersRef.current.chart = setTimeout(() => {
      console.log(`[Retry] Chart attempt ${retryCountersRef.current.chart}/${MAX_RETRIES}`);
      fetchChartWithRetry(asset);
    }, RETRY_DELAY_MS);
  };

  // Retry handler for Meme
  const fetchMemeWithRetry = async () => {
    if (!data?.meta?.contentTypes?.includes('Fun')) return;
    
    try {
      const memeData = await api.getMeme();
      setData((prev) => ({
        ...prev,
        meme: memeData.meme ?? prev.meme,
        memeSource: memeData.memeSource ?? prev.memeSource,
        memeUpdatedAt: memeData.memeUpdatedAt,
        memeError: memeData.memeError ?? null,
      }));
      // Reset retry counter on success
      if (memeData.memeSource === 'live' || memeData.memeSource === 'cache') {
        retryCountersRef.current.meme = 0;
      } else if (memeData.memeSource === 'fallback') {
        scheduleMemeRetry();
      }
    } catch (err) {
      console.error('Failed to fetch meme:', err);
      scheduleMemeRetry();
    }
  };

  const scheduleMemeRetry = () => {
    if (retryCountersRef.current.meme >= MAX_RETRIES) return;
    if (retryTimersRef.current.meme) clearTimeout(retryTimersRef.current.meme);
    
    retryCountersRef.current.meme += 1;
    retryTimersRef.current.meme = setTimeout(() => {
      console.log(`[Retry] Meme attempt ${retryCountersRef.current.meme}/${MAX_RETRIES}`);
      fetchMemeWithRetry();
    }, RETRY_DELAY_MS);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Fetch AI in background after dashboard loads
  useEffect(() => {
    if (data && data.meta?.contentTypes?.includes('AI Insights') && data.aiSource === 'pending') {
      fetchAIInsight();
    }
  }, [data?.aiSource, data?.meta?.contentTypes]);

  // Schedule retry for AI if it's fallback
  useEffect(() => {
    if (data?.aiSource === 'fallback') {
      scheduleAIRetry();
    }
  }, [data?.aiSource]);

  // Hydrate live sections in the background (non-blocking)
  useEffect(() => {
    if (!data?.meta || sectionsHydratedRef.current) return;
    sectionsHydratedRef.current = true;

    const contentTypes = data.meta.contentTypes || [];
    const assets = data.meta.selectedAssets || [];

    const hydratePrices = async () => {
      setSectionLoading((s) => ({ ...s, prices: true }));
      try {
        const priceData = await api.getPrices();
        setData((prev) => ({
          ...prev,
          coinPrices: priceData.coinPrices ?? prev.coinPrices,
          priceSource: priceData.priceSource ?? prev.priceSource,
          priceUpdatedAt: priceData.priceUpdatedAt,
          priceError: priceData.priceError ?? null,
          meta: { ...prev.meta, selectedAssets: priceData.selectedAssets ?? prev.meta?.selectedAssets },
        }));
      } catch (err) {
        console.error('Failed to refresh prices:', err);
      } finally {
        setSectionLoading((s) => ({ ...s, prices: false }));
      }
    };

    const hydrateNews = async () => {
      if (!contentTypes.includes('Market News')) return;
      setSectionLoading((s) => ({ ...s, news: true }));
      try {
        await fetchNewsWithRetry();
      } finally {
        setSectionLoading((s) => ({ ...s, news: false }));
      }
    };

    const hydrateChart = async () => {
      if (!contentTypes.includes('Charts') || assets.length === 0) return;
      const asset = data.selectedChartAsset || assets[0];
      setSectionLoading((s) => ({ ...s, chart: true }));
      try {
        await fetchChartWithRetry(asset);
      } finally {
        setSectionLoading((s) => ({ ...s, chart: false }));
      }
    };

    const hydrateMeme = async () => {
      if (!contentTypes.includes('Fun')) return;
      setSectionLoading((s) => ({ ...s, meme: true }));
      try {
        await fetchMemeWithRetry();
      } finally {
        setSectionLoading((s) => ({ ...s, meme: false }));
      }
    };

    hydratePrices();
    hydrateNews();
    hydrateChart();
    hydrateMeme();
  }, [data]);

  const [toast, setToast] = useState('');

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const applyAssetUpdate = async (newAssets) => {
    const result = await api.updateAssets(newAssets);
    const savedAssets = result.preferences?.assets ?? newAssets;
    const priceData = await api.getPrices();
    setData((prev) => ({
      ...prev,
      coinPrices: priceData.coinPrices ?? [],
      priceSource: priceData.priceSource ?? 'fallback',
      priceUpdatedAt: priceData.priceUpdatedAt,
      priceError: priceData.priceError ?? null,
      meta: { ...prev.meta, selectedAssets: savedAssets },
    }));
    return savedAssets;
  };

  const handleAddCoin = async () => {
    if (!selectedCoinToAdd) return;
    const currentAssets = data.meta?.selectedAssets ?? [];
    if (currentAssets.includes(selectedCoinToAdd)) return;

    const newAssets = [...currentAssets, selectedCoinToAdd];
    setSavingCoins(true);
    try {
      await applyAssetUpdate(newAssets);
      setSelectedCoinToAdd('');
      showToast(`Added ${selectedCoinToAdd}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to add coin');
    } finally {
      setSavingCoins(false);
    }
  };

  const handleRemoveCoin = async (coinName) => {
    const currentAssets = data.meta?.selectedAssets ?? [];
    const newAssets = currentAssets.filter((a) => a !== coinName);

    setSavingCoins(true);
    try {
      await applyAssetUpdate(newAssets);
      showToast(`Removed ${coinName}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to remove coin');
    } finally {
      setSavingCoins(false);
    }
  };

  const handleChartAssetChange = async (e) => {
    const newAsset = e.target.value;
    if (newAsset === data.selectedChartAsset) return;

    setChartLoading(true);
    // Reset retry counter for new asset
    retryCountersRef.current.chart = 0;
    try {
      await fetchChartWithRetry(newAsset);
    } finally {
      setChartLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex-center min-h-screen">
        <div className="card text-center" style={{ color: 'var(--danger)' }}>{error}</div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>
            <span style={{ color: 'var(--primary)' }}>AI</span> Crypto Advisor
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Welcome back{user?.name ? `, ${user.name}` : ''}…
          </p>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card" style={{ minHeight: 340, padding: '1.25rem' }}>
              <CardSkeleton lines={4} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const selectedAssets = data.meta?.selectedAssets ?? [];
  const priceByName = new Map((data.coinPrices || []).map((c) => [c.name, c]));
  const displayCoins = selectedAssets
    .map((name) => priceByName.get(name))
    .filter(Boolean);
  const availableToAdd = ALL_AVAILABLE_COINS.filter((c) => !selectedAssets.includes(c));

  const contentTypes = data.meta.contentTypes || [];
  const showCharts = contentTypes.includes('Charts');
  const showAI = contentTypes.includes('AI Insights');
  const showNews = contentTypes.includes('Market News');
  const showMeme = contentTypes.includes('Fun');
  const showNone = !showAI && !showNews && !showMeme && !showCharts;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem', position: 'relative' }}>
      
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary)', color: 'white', padding: '0.75rem 1.5rem',
          borderRadius: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000,
          fontWeight: 'bold', animation: 'fadein 0.3s'
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--primary)' }}>AI</span> Crypto Advisor
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Welcome back, {user?.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <User size={14} /> {data.meta?.investorType}
          </div>
          <button onClick={logout} className="btn" style={{ padding: '0.5rem', backgroundColor: 'transparent', color: 'var(--text-muted)' }} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Coin Prices */}
        <DashboardCard title="Market Overview" section="coin_prices">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Your Tracked Assets</span>
              <span style={{ 
                fontSize: '0.7rem', 
                padding: '0.15rem 0.4rem', 
                borderRadius: '0.25rem', 
                backgroundColor: data.priceSource === 'live' ? 'rgba(34, 197, 94, 0.1)' : data.priceSource === 'cache' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: data.priceSource === 'live' ? 'var(--success)' : data.priceSource === 'cache' ? '#3b82f6' : 'var(--danger)',
                display: 'inline-block',
                width: 'fit-content'
              }}>
                {sectionLoading.prices ? 'Updating prices…' : data.priceSource === 'live' ? 'Live prices' : data.priceSource === 'cache' ? 'Cached live prices' : 'Fallback demo prices'}
              </span>
              {data.priceError && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{data.priceError}</span>}
            </div>
            <button 
              onClick={() => setEditMode(!editMode)} 
              className="btn" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              disabled={savingCoins}
            >
              {editMode ? <><Check size={14} /> Done</> : <><Edit2 size={14} /> Edit</>}
            </button>
          </div>

          {editMode && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <select 
                className="form-input" 
                style={{ flex: 1, padding: '0.5rem' }}
                value={selectedCoinToAdd}
                onChange={(e) => setSelectedCoinToAdd(e.target.value)}
                disabled={savingCoins}
              >
                <option value="">Select a coin...</option>
                {availableToAdd.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button 
                className="btn btn-primary" 
                onClick={handleAddCoin}
                disabled={!selectedCoinToAdd || savingCoins}
                style={{ padding: '0.5rem 1rem' }}
              >
                <Plus size={18} />
              </button>
            </div>
          )}

          {/* Scrollable coin list — shows ~5 coins, scroll for more */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxHeight: '340px',
            overflowY: 'auto',
            paddingRight: '4px',  /* prevent scrollbar overlap */
          }}>
            {selectedAssets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                No coins tracked. Click Edit to add some!
              </div>
            ) : (
              displayCoins.map(coin => (
                <div key={coin.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-dark)', borderRadius: '0.5rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {editMode && (
                      <button
                        onClick={() => handleRemoveCoin(coin.name)}
                        disabled={savingCoins}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: coin.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                      {coin.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600' }}>{coin.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{coin.symbol}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600' }}>${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                    <div style={{ fontSize: '0.875rem', color: coin.change24h >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {coin.change24h > 0 ? '+' : ''}{Number(coin.change24h).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        {/* Charts */}
        {showCharts && (
          <DashboardCard title="Market Charts" section="charts">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '0.25rem',
                    backgroundColor: data.chartSource === 'live' ? 'rgba(34, 197, 94, 0.1)' : data.chartSource === 'cache' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: data.chartSource === 'live' ? 'var(--success)' : data.chartSource === 'cache' ? '#3b82f6' : 'var(--danger)',
                    display: 'inline-block',
                    width: 'fit-content'
                  }}>
                    {data.chartSource === 'live' ? 'Live chart' : data.chartSource === 'cache' ? 'Cached chart' : 'Fallback demo chart'}
                  </span>
                  {data.chartError && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{data.chartError}</span>}
                </div>
                
                <select 
                  value={data.selectedChartAsset || ''} 
                  onChange={handleChartAssetChange}
                  disabled={chartLoading}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-dark)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    fontSize: '0.875rem',
                    cursor: chartLoading ? 'wait' : 'pointer'
                  }}
                >
                  {selectedAssets.map(asset => (
                    <option key={asset} value={asset}>{asset}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, width: '100%', minHeight: '250px', position: 'relative' }}>
                {chartLoading && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 10 }}>
                    Loading...
                  </div>
                )}
                {data.chartData && data.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        stroke="var(--text-muted)" 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
                        itemStyle={{ color: 'var(--primary)' }}
                        formatter={(value) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`, 'Price']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="var(--primary)" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--bg-card)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No chart data available
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>
        )}

        {/* AI Insight */}
        {showAI && (
          <DashboardCard title="AI Insight of the Day" section="ai_insight" itemId={data.aiInsight?.id}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              justifyContent: 'center', 
              padding: '1rem 0',
              maxHeight: '340px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {/* aiSource badge */}
              <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '0.25rem',
                  backgroundColor: data.aiSource === 'live' ? 'rgba(34, 197, 94, 0.1)' : data.aiSource === 'cache' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: data.aiSource === 'live' ? 'var(--success)' : data.aiSource === 'cache' ? '#3b82f6' : 'var(--danger)',
                  display: 'inline-block',
                }}>
                  {data.aiSource === 'live' ? 'Live AI insight' : data.aiSource === 'cache' ? 'Cached AI insight' : data.aiSource === 'pending' ? 'Loading AI insight…' : 'Fallback demo insight'}
                </span>
                {data.aiError && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{data.aiError}</span>
                )}
              </div>
              <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>{data.aiInsight?.emoji}</div>
              <h4 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '0.5rem' }}>{data.aiInsight?.title}</h4>
              <p style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', fontStyle: 'italic', lineHeight: '1.6' }}>
                "{data.aiInsight?.body}"
              </p>
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <span className="badge">Confidence: {data.aiInsight?.confidence}</span>
              </div>
            </div>
          </DashboardCard>
        )}

        {/* Market News */}
        {showNews && (
          <DashboardCard title="Market News" section="market_news">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.4rem', 
                  borderRadius: '0.25rem', 
                  backgroundColor: data.newsSource === 'live' ? 'rgba(34, 197, 94, 0.1)' : data.newsSource === 'cache' ? 'rgba(59, 130, 246, 0.1)' : data.newsSource === 'pending' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  color: data.newsSource === 'live' ? 'var(--success)' : data.newsSource === 'cache' ? '#3b82f6' : data.newsSource === 'pending' ? 'var(--text-muted)' : 'var(--danger)',
                  display: 'inline-block',
                  width: 'fit-content'
                }}>
                  {data.newsSource === 'live' ? 'Live news' : data.newsSource === 'cache' ? 'Cached live news' : data.newsSource === 'pending' ? 'Loading news…' : 'Fallback demo news'}
                </span>
                {data.newsError && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{data.newsError}</span>}
              </div>
            </div>
            {sectionLoading.news && (!data.marketNews || data.marketNews.length === 0) ? (
              <CardSkeleton lines={4} />
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: sectionLoading.news ? 0.7 : 1 }}>
              {data.marketNews?.slice(0, 3).map((news) => {
                const timeLabel = formatNewsTime(news.publishedAt);
                return (
                <div key={news.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>{news.source}</span>
                    {timeLabel && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeLabel}</span>
                    )}
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                    {news.url ? (
                      <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {news.title}
                      </a>
                    ) : (
                      news.title
                    )}
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {news.summary}
                  </p>
                </div>
                );
              })}
            </div>
            )}
          </DashboardCard>
        )}

        {/* Meme */}
        {showMeme && (
          <DashboardCard title="Crypto Culture" section="meme" itemId={data.meme?.id}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

              {/* memeSource badge + error */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '0.25rem',
                  backgroundColor: data.memeSource === 'live' ? 'rgba(34, 197, 94, 0.1)' : data.memeSource === 'cache' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: data.memeSource === 'live' ? 'var(--success)' : data.memeSource === 'cache' ? '#3b82f6' : 'var(--danger)',
                  display: 'inline-block',
                  width: 'fit-content',
                }}>
                  {data.memeSource === 'live' ? 'Live crypto meme' : data.memeSource === 'cache' ? 'Cached crypto meme' : 'Fallback demo crypto meme'}
                </span>
                {data.memeError && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{data.memeError}</span>
                )}
              </div>

              {/* Live / cached meme — show real image */}
              {data.meme?.imageUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                  <a href={data.meme.url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%' }}>
                    <img
                      src={data.meme.imageUrl}
                      alt={data.meme.title}
                      style={{
                        width: '100%',
                        maxHeight: '260px',
                        objectFit: 'contain',
                        borderRadius: '0.5rem',
                        display: 'block',
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </a>
                  <p style={{ fontSize: '0.9rem', fontWeight: '600', textAlign: 'center', margin: 0 }}>
                    {data.meme.url ? (
                      <a href={data.meme.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {data.meme.title}
                      </a>
                    ) : data.meme.title}
                  </p>
                  {data.meme.subreddit && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      r/{data.meme.subreddit} · {data.meme.source}
                    </span>
                  )}
                </div>
              ) : (
                /* Static fallback meme — emoji + text layout */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0', gap: '0.75rem' }}>
                  <div style={{ fontSize: '4rem' }}>{data.meme?.emoji}</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>
                    {data.meme?.text}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                    {data.meme?.subtext}
                  </p>
                  <span className="badge">{data.meme?.label}</span>
                </div>
              )}

            </div>
          </DashboardCard>
        )}

      </div>

      {showNone && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>You haven't selected any optional content.</p>
          <p>You can customize your content preferences from onboarding/settings.</p>
        </div>
      )}

      {/* Educational disclaimer */}
      <p style={{
        marginTop: '2.5rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        letterSpacing: '0.01em',
        padding: '0 1rem',
      }}>
        ⚠️ This dashboard is for educational purposes only and is not financial advice.
      </p>
    </div>
  );
}
