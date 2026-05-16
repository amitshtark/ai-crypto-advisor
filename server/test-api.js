import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:5001/api';

function assertSameAssets(actual, expected, label) {
  const a = [...(actual || [])].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    throw new Error(`${label}: expected [${e.join(', ')}] but got [${a.join(', ')}]`);
  }
}

function getTrackedAssets(dashboard) {
  return dashboard.meta?.selectedAssets || [];
}

function getCoinNames(dashboard) {
  return (dashboard.coinPrices || []).map((c) => c.name);
}

async function fetchDashboard(token) {
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Dashboard failed: ' + JSON.stringify(data));
  return data;
}

async function updateAssets(token, assets) {
  const res = await fetch(`${API_URL}/onboarding/preferences/assets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assets }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Update assets failed: ' + JSON.stringify(data));
  return data;
}

async function runTests() {
  let token = '';
  let testUserEmail = `test${Date.now()}@example.com`;

  console.log('--- Starting API Tests ---');

  try {
    // 1. Signup
    console.log('1. Testing POST /api/auth/signup...');
    let res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: testUserEmail, password: 'password123' })
    });
    let data = await res.json();
    if (!res.ok) throw new Error('Signup failed: ' + JSON.stringify(data));
    console.log('   ✅ Signup successful');

    // 2. Login
    console.log('2. Testing POST /api/auth/login...');
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'password123' })
    });
    data = await res.json();
    if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(data));
    token = data.token;
    console.log('   ✅ Login successful, token received');

    // 3. GET /auth/me
    console.log('3. Testing GET /api/auth/me...');
    res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    if (!res.ok) throw new Error('Get Me failed: ' + JSON.stringify(data));
    console.log('   ✅ Get Me successful');

    // 4. Onboarding
    console.log('4. Testing POST /api/onboarding...');
    res = await fetch(`${API_URL}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        assets: ['Bitcoin', 'Ethereum'],
        investorType: 'HODLer',
        contentTypes: ['Market News', 'AI Insights', 'Charts']
      })
    });
    data = await res.json();
    if (!res.ok) throw new Error('Onboarding failed: ' + JSON.stringify(data));
    console.log('   ✅ Onboarding successful');

    // 5. Dashboard (First call)
    console.log('5. Testing GET /api/dashboard (First call)...');
    res = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    if (!res.ok) throw new Error('Dashboard failed: ' + JSON.stringify(data));

    // Verify required sections and meta
    if (!data.coinPrices) throw new Error('Dashboard missing coinPrices');
    if (!data.meta || !Array.isArray(data.meta.contentTypes)) throw new Error('Dashboard missing meta.contentTypes');

    // Verify source fields
    if (!data.priceSource) throw new Error('Dashboard missing priceSource field');
    if (!data.newsSource)  throw new Error('Dashboard missing newsSource field');
    if (!data.aiSource)    throw new Error('Dashboard missing aiSource field');
    if (!data.memeSource)  throw new Error('Dashboard missing memeSource field');
    if (!data.chartSource) throw new Error('Dashboard missing chartSource field');

    // Verify newsSource is one of the expected values
    const validSources = ['live', 'cache', 'fallback', 'skipped', 'pending'];
    if (!validSources.includes(data.newsSource)) {
      throw new Error(`newsSource has unexpected value: ${data.newsSource}`);
    }

    if (data.meta.contentTypes.includes('Market News')) {
      if (!Array.isArray(data.marketNews) || data.marketNews.length === 0) {
        throw new Error('Dashboard marketNews is missing or empty');
      }
    } else {
      if (data.newsSource !== 'skipped' || data.marketNews) {
        throw new Error('marketNews should be skipped and deleted');
      }
    }

    // Verify aiSource
    // AI is now fetched separately, so main dashboard returns "pending"
    const validAISources = ['live', 'cache', 'fallback', 'skipped', 'pending'];
    if (!validAISources.includes(data.aiSource)) {
      throw new Error(`aiSource has unexpected value: ${data.aiSource}`);
    }

    if (data.meta.contentTypes.includes('AI Insights')) {
      // Main dashboard returns pending AI initially
      if (data.aiSource !== 'pending') {
        throw new Error(`Expected aiSource to be 'pending' but got '${data.aiSource}'`);
      }
      if (!data.aiInsight || !data.aiInsight.title || !data.aiInsight.emoji) {
        throw new Error('aiInsight missing required fields: ' + JSON.stringify(data.aiInsight));
      }
    } else {
      if (data.aiSource !== 'skipped' || data.aiInsight) {
        throw new Error('aiInsight should be skipped and deleted');
      }
    }

    // Verify memeSource
    if (!validSources.includes(data.memeSource)) {
      throw new Error(`memeSource has unexpected value: ${data.memeSource}`);
    }

    let memeDesc = data.memeSource;
    if (data.meta.contentTypes.includes('Fun')) {
      if (!data.meme || typeof data.meme !== 'object') {
        throw new Error('Dashboard meme object missing or invalid');
      }
      memeDesc = data.memeSource === 'fallback'
        ? `fallback (${data.memeError ?? 'no error msg'})`
        : `${data.memeSource} — r/${data.meme.subreddit ?? 'unknown'}`;
    } else {
      if (data.memeSource !== 'skipped' || data.meme) {
        throw new Error('meme should be skipped and deleted');
      }
    }

    // Verify chartSource
    if (!validSources.includes(data.chartSource)) {
      throw new Error(`chartSource has unexpected value: ${data.chartSource}`);
    }

    if (data.meta.contentTypes.includes('Charts')) {
      if (!data.chartData || !Array.isArray(data.chartData) || data.chartData.length === 0) {
        throw new Error('Dashboard chartData is missing or empty');
      }
      if (!data.selectedChartAsset) {
        throw new Error('Dashboard selectedChartAsset is missing');
      }
    } else {
      if (data.chartSource !== 'skipped' || data.chartData) {
        throw new Error('chartData should be skipped and deleted');
      }
    }

    console.log(`   ✅ First dashboard load (priceSource: ${data.priceSource}, newsSource: ${data.newsSource}, aiSource: ${data.aiSource}, memeSource: ${memeDesc}, chartSource: ${data.chartSource})`);

    // 5b. Dashboard (Second call — cache check)
    console.log('5b. Testing GET /api/dashboard (Second call for cache)...');
    let res2 = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let data2 = await res2.json();
    if (!res2.ok) throw new Error('Second dashboard call failed: ' + JSON.stringify(data2));

    // Main dashboard should always return pending AI, not cache/live
    if (data2.meta.contentTypes.includes('AI Insights') && data2.aiSource !== 'pending') {
      throw new Error(`Expected AI to still be 'pending' on second call but got '${data2.aiSource}'`);
    }

    const cacheWarnings = [];
    if (data.priceSource === 'live' && data2.priceSource !== 'cache') {
      cacheWarnings.push(`price: expected cache but got ${data2.priceSource}`);
    }
    if (data.newsSource === 'live' && data2.newsSource !== 'cache') {
      cacheWarnings.push(`news: expected cache but got ${data2.newsSource}`);
    }
    if (data.memeSource === 'live' && data2.memeSource !== 'cache') {
      cacheWarnings.push(`meme: expected cache but got ${data2.memeSource}`);
    }
    if (data.chartSource === 'live' && data2.chartSource !== 'cache') {
      cacheWarnings.push(`chart: expected cache but got ${data2.chartSource}`);
    }
    
    if (cacheWarnings.length > 0) {
      console.warn(`   ⚠️ Cache warning(s): ${cacheWarnings.join(', ')}`);
    } else {
      console.log(`   ✅ Second dashboard load (priceSource: ${data2.priceSource}, newsSource: ${data2.newsSource}, aiSource: ${data2.aiSource}, memeSource: ${data2.memeSource}, chartSource: ${data2.chartSource})`);
    }

    // 5c. Testing GET /api/dashboard/chart
    console.log('5c. Testing GET /api/dashboard/chart...');
    const chartAsset = 'Ethereum';
    const chartRes = await fetch(`${API_URL}/dashboard/chart?asset=${chartAsset}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chartData = await chartRes.json();
    if (!chartRes.ok) throw new Error('Chart route failed: ' + JSON.stringify(chartData));
    
    if (!chartData.chartData || chartData.selectedAsset !== chartAsset) {
      throw new Error('Invalid chart response: ' + JSON.stringify(chartData));
    }
    console.log(`   ✅ Chart endpoint load (chartSource: ${chartData.chartSource})`);

    // 5d. Testing GET /api/dashboard/ai (new non-blocking endpoint)
    console.log('5d. Testing GET /api/dashboard/ai...');
    const aiRes = await fetch(`${API_URL}/dashboard/ai`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error('AI route failed: ' + JSON.stringify(aiData));
    
    const validAIEndpointSources = ['live', 'cache', 'fallback'];
    if (!validAIEndpointSources.includes(aiData.aiSource)) {
      throw new Error(`AI endpoint returned unexpected aiSource: ${aiData.aiSource}`);
    }
    if (!aiData.aiInsight || !aiData.aiInsight.title || !aiData.aiInsight.body || !aiData.aiInsight.emoji) {
      throw new Error('AI endpoint missing required fields: ' + JSON.stringify(aiData.aiInsight));
    }
    console.log(`   ✅ AI endpoint load (aiSource: ${aiData.aiSource})`);

    // 5e. AI endpoint skipped when user did not select AI Insights
    console.log('5e. Testing GET /api/dashboard/ai (skipped when AI Insights not selected)...');
    const noAiEmail = `noai${Date.now()}@example.com`;
    let noAiRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No AI User', email: noAiEmail, password: 'password123' }),
    });
    let noAiData = await noAiRes.json();
    if (!noAiRes.ok) throw new Error('No-AI signup failed: ' + JSON.stringify(noAiData));

    noAiRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: noAiEmail, password: 'password123' }),
    });
    noAiData = await noAiRes.json();
    if (!noAiRes.ok) throw new Error('No-AI login failed: ' + JSON.stringify(noAiData));
    const noAiToken = noAiData.token;

    noAiRes = await fetch(`${API_URL}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${noAiToken}` },
      body: JSON.stringify({
        assets: ['Bitcoin'],
        investorType: 'HODLer',
        contentTypes: ['Market News', 'Charts'],
      }),
    });
    noAiData = await noAiRes.json();
    if (!noAiRes.ok) throw new Error('No-AI onboarding failed: ' + JSON.stringify(noAiData));

    noAiRes = await fetch(`${API_URL}/dashboard/ai`, {
      headers: { Authorization: `Bearer ${noAiToken}` },
    });
    noAiData = await noAiRes.json();
    if (!noAiRes.ok) throw new Error('No-AI /dashboard/ai failed: ' + JSON.stringify(noAiData));
    if (noAiData.aiSource !== 'skipped') {
      throw new Error(`Expected aiSource 'skipped' but got '${noAiData.aiSource}'`);
    }
    if (!noAiData.aiError || !noAiData.aiError.includes('not enabled')) {
      throw new Error('Expected aiError about AI Insights not enabled');
    }
    if (noAiData.aiInsight) {
      throw new Error('aiInsight should be omitted when AI Insights is skipped');
    }
    console.log('   ✅ AI endpoint skipped when AI Insights not selected');

    // 6. Feedback
    console.log('6. Testing POST /api/feedback...');
    res = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        section: 'market_news',
        itemId: 'news-1',
        vote: 'up'
      })
    });
    data = await res.json();
    if (!res.ok) throw new Error('Feedback failed: ' + JSON.stringify(data));
    console.log('   ✅ Feedback submitted successfully');

    // 7. Market Overview — asset add/remove persistence
    console.log('7. Testing Market Overview asset updates...');
    let dashboard = await fetchDashboard(token);
    assertSameAssets(getTrackedAssets(dashboard), ['Bitcoin', 'Ethereum'], 'after onboarding');
    assertSameAssets(getCoinNames(dashboard), ['Bitcoin', 'Ethereum'], 'dashboard coins after onboarding');

    await updateAssets(token, ['Bitcoin']);
    dashboard = await fetchDashboard(token);
    assertSameAssets(getTrackedAssets(dashboard), ['Bitcoin'], 'after remove Ethereum');
    assertSameAssets(getCoinNames(dashboard), ['Bitcoin'], 'dashboard coins after remove Ethereum');

    const pricesRes = await fetch(`${API_URL}/dashboard/prices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pricesData = await pricesRes.json();
    if (!pricesRes.ok) throw new Error('Prices failed: ' + JSON.stringify(pricesData));
    assertSameAssets(pricesData.selectedAssets, ['Bitcoin'], 'prices selectedAssets');
    assertSameAssets(
      (pricesData.coinPrices || []).map((c) => c.name),
      ['Bitcoin'],
      'prices endpoint coins'
    );

    await updateAssets(token, ['Bitcoin', 'Solana']);
    dashboard = await fetchDashboard(token);
    assertSameAssets(getTrackedAssets(dashboard), ['Bitcoin', 'Solana'], 'after add Solana');
    assertSameAssets(getCoinNames(dashboard), ['Bitcoin', 'Solana'], 'dashboard coins after add Solana');

    await updateAssets(token, []);
    dashboard = await fetchDashboard(token);
    assertSameAssets(getTrackedAssets(dashboard), [], 'after clear all assets');
    if ((dashboard.coinPrices || []).length !== 0) {
      throw new Error('Expected empty coinPrices when no assets tracked');
    }

    await updateAssets(token, ['Cardano']);
    dashboard = await fetchDashboard(token);
    assertSameAssets(getTrackedAssets(dashboard), ['Cardano'], 'after set Cardano only');
    assertSameAssets(getCoinNames(dashboard), ['Cardano'], 'dashboard coins Cardano only');
    console.log('   ✅ Market Overview asset updates passed');

    // 8. Verify Database via Prisma
    console.log('8. Verifying data in Database via Prisma...');
    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    if (!user || !user.hasOnboarded) throw new Error('User onboarded flag not set in DB');
    
    const pref = await prisma.preference.findUnique({ where: { userId: user.id } });
    const savedAssets = JSON.parse(pref.assets);
    assertSameAssets(savedAssets, ['Cardano'], 'DB preference assets');
    
    const feedback = await prisma.feedback.findFirst({ where: { userId: user.id } });
    if (!feedback || feedback.vote !== 'up') throw new Error('Feedback not properly saved in DB');
    
    console.log('   ✅ Database verification passed');
    console.log('--- All API Tests Passed! 🎉 ---');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
