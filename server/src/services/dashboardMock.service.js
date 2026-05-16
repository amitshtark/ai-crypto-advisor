/**
 * Dashboard Mock Service
 * 
 * All content here is static mock data. Future versions will integrate:
 * - CoinGecko API for real-time prices
 * - CryptoPanic for news feeds
 * - OpenRouter / Hugging Face for AI insights
 * - Reddit for memes
 */

const ALL_PRICES = {
  Bitcoin: {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 67_420.00,
    change24h: +2.34,
    marketCap: '1.32T',
    icon: '₿',
    color: '#F7931A',
  },
  Ethereum: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3_512.80,
    change24h: +1.87,
    marketCap: '422B',
    icon: 'Ξ',
    color: '#627EEA',
  },
  Solana: {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    price: 178.45,
    change24h: -0.92,
    marketCap: '81B',
    icon: '◎',
    color: '#9945FF',
  },
  Dogecoin: {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    price: 0.1632,
    change24h: +5.21,
    marketCap: '23B',
    icon: 'Ð',
    color: '#C2A633',
  },
  Cardano: {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    price: 0.4521,
    change24h: -1.43,
    marketCap: '16B',
    icon: '₳',
    color: '#0D1E2D',
  },
  Polygon: {
    id: 'polygon',
    symbol: 'MATIC',
    name: 'Polygon',
    price: 0.7183,
    change24h: +3.12,
    marketCap: '7B',
    icon: '⬡',
    color: '#8247E5',
  },
  'Binance Coin': {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'Binance Coin',
    price: 590.21,
    change24h: +1.2,
    marketCap: '87B',
    icon: 'BNB',
    color: '#F3BA2F',
  },
  XRP: {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    price: 0.521,
    change24h: -0.5,
    marketCap: '28B',
    icon: '✕',
    color: '#23292F',
  },
  Litecoin: {
    id: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    price: 84.15,
    change24h: +2.1,
    marketCap: '6B',
    icon: 'Ł',
    color: '#345D9D',
  },
  Avalanche: {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    price: 35.80,
    change24h: +4.5,
    marketCap: '13B',
    icon: '🔺',
    color: '#E84142',
  },
};

const ALL_NEWS = [
  {
    id: 'news-1',
    title: 'Bitcoin Breaks Key Resistance at $67K',
    summary: 'BTC surged past the $67,000 mark amid strong institutional demand and positive macro signals from the Fed.',
    source: 'CryptoDaily',
    tags: ['Bitcoin'],
    time: '2h ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-2',
    title: 'Ethereum Dencun Upgrade Reduces Layer-2 Fees by 90%',
    summary: 'The Dencun hard fork is live, and early data shows dramatically lower transaction costs across major L2s.',
    source: 'The Block',
    tags: ['Ethereum'],
    time: '4h ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-3',
    title: 'Solana Network Reaches Record 65,000 TPS',
    summary: 'Solana\'s validator network hit a new all-time high in transactions per second during yesterday\'s peak.',
    source: 'Decrypt',
    tags: ['Solana'],
    time: '6h ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-4',
    title: 'Dogecoin Community Rallies Around New Meme Campaign',
    summary: 'DOGE holders are pushing a viral campaign that has already trended on X for 12 hours straight.',
    source: 'CoinTelegraph',
    tags: ['Dogecoin'],
    time: '8h ago',
    sentiment: 'neutral',
  },
  {
    id: 'news-5',
    title: 'Cardano Announces Hydra Head Protocol Live on Mainnet',
    summary: 'Input Output Group confirms Hydra is now live, promising near-instant finality and massive scalability.',
    source: 'CryptoSlate',
    tags: ['Cardano'],
    time: '10h ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-6',
    title: 'Polygon zkEVM Processes 1 Billion Transactions',
    summary: 'Polygon\'s zkEVM milestone marks a major achievement for zero-knowledge rollup technology.',
    source: 'BeInCrypto',
    tags: ['Polygon'],
    time: '12h ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-7',
    title: 'SEC Approves New Crypto Spot ETF Applications',
    summary: 'The SEC greenlights several new spot ETF applications, opening doors for broader institutional access.',
    source: 'Bloomberg Crypto',
    tags: ['Bitcoin', 'Ethereum'],
    time: '1d ago',
    sentiment: 'bullish',
  },
  {
    id: 'news-8',
    title: 'DeFi TVL Hits $120B as Lending Protocols Surge',
    summary: 'Total value locked across DeFi protocols climbed to a new high as yield farming rewards attracted capital.',
    source: 'DeFi Pulse',
    tags: ['Ethereum', 'Polygon'],
    time: '1d ago',
    sentiment: 'bullish',
  },
];

const ALL_INSIGHTS = {
  HODLer: [
    {
      id: 'insight-hodler-1',
      title: 'The Diamond Hands Signal',
      body: 'Long-term on-chain data shows that wallets holding for 1+ year are at an all-time high. Historically, this pattern precedes major upward moves. Your patience may be your greatest edge.',
      confidence: 'High',
      emoji: '💎',
    },
    {
      id: 'insight-hodler-2',
      title: 'Accumulation Phase Detected',
      body: 'Exchange outflows are spiking — coins are moving to cold storage. This is a classic HODLer accumulation signal, suggesting reduced selling pressure ahead.',
      confidence: 'Medium',
      emoji: '🔐',
    },
  ],
  'Day Trader': [
    {
      id: 'insight-trader-1',
      title: 'Volatility Window Opening',
      body: 'BTC options data shows a volatility squeeze that historically precedes a 5-10% move within 48 hours. Set your alerts — direction could break either way.',
      confidence: 'Medium',
      emoji: '⚡',
    },
    {
      id: 'insight-trader-2',
      title: 'Funding Rates Flip Negative',
      body: 'Perpetual futures funding rates went negative — shorts are paying longs. This contrarian signal has historically preceded short squeezes in the past 6 months.',
      confidence: 'High',
      emoji: '📉',
    },
  ],
  'NFT Collector': [
    {
      id: 'insight-nft-1',
      title: 'Blue-Chip NFT Floor Prices Rising',
      body: 'Bored Apes and Pudgy Penguins floor prices climbed 12% this week. Ethereum gas fees are relatively low — a good window to explore acquisitions.',
      confidence: 'Medium',
      emoji: '🖼️',
    },
    {
      id: 'insight-nft-2',
      title: 'New NFT Marketplace Gaining Traction',
      body: 'Blur\'s aggressive incentive program is shifting wash trading volume. Genuine collector activity on OpenSea is showing a healthy uptick in unique buyers.',
      confidence: 'Low',
      emoji: '🎨',
    },
  ],
  'DeFi Explorer': [
    {
      id: 'insight-defi-1',
      title: 'Yield Opportunity Detected',
      body: 'stETH-ETH pools on Curve are offering 8.2% APY with minimal impermanent loss risk. This window typically closes within days as capital floods in.',
      confidence: 'Medium',
      emoji: '🌾',
    },
    {
      id: 'insight-defi-2',
      title: 'Governance Vote Could Impact TVL',
      body: 'MakerDAO\'s upcoming governance vote on DAI savings rate adjustment is attracting close scrutiny. A rate hike could shift billions of stablecoin liquidity.',
      confidence: 'High',
      emoji: '🏛️',
    },
  ],
  Beginner: [
    {
      id: 'insight-beginner-1',
      title: 'Dollar-Cost Averaging Is Your Friend',
      body: 'Market timing is notoriously difficult even for professionals. Investing a fixed amount weekly regardless of price has outperformed lump-sum investing in 7 of the last 10 bear markets.',
      confidence: 'High',
      emoji: '📅',
    },
    {
      id: 'insight-beginner-2',
      title: 'Understanding Market Cycles',
      body: 'Crypto markets tend to follow 4-year cycles tied to Bitcoin\'s halving. We appear to be in the early-mid bull phase. Staying calm during dips is a skill — and a superpower.',
      confidence: 'Medium',
      emoji: '🎓',
    },
  ],
};

const MEMES = [
  {
    id: 'meme-1',
    text: '"Not your keys, not your coins."',
    subtext: 'The oldest wisdom in crypto — always self-custody your assets.',
    emoji: '🔑',
    label: 'Crypto Proverb',
  },
  {
    id: 'meme-2',
    text: '"We\'re all gonna make it." — Crypto Twitter, every day since 2011',
    subtext: 'The eternal optimism of the crypto community never gets old.',
    emoji: '🚀',
    label: 'Crypto Culture',
  },
  {
    id: 'meme-3',
    text: '"Wen moon?" – Someone, every 4 minutes on Reddit',
    subtext: 'The patience of a crypto investor: measured in blocks, not days.',
    emoji: '🌕',
    label: 'Classic Meme',
  },
  {
    id: 'meme-4',
    text: '"Buy the dip. Buy the dip. Oh no, it\'s still dipping."',
    subtext: 'Every HODLer\'s internal monologue during a bear market.',
    emoji: '📉',
    label: 'Bear Market Energy',
  },
  {
    id: 'meme-5',
    text: '"This is fine." 🔥 — DeFi farmer watching gas prices hit 500 gwei',
    subtext: 'The DeFi tax: paying more in gas than your actual yield.',
    emoji: '⛽',
    label: 'DeFi Moment',
  },
  {
    id: 'meme-6',
    text: '"I\'m not selling — I\'m just swapping to a different chain to sell."',
    subtext: 'Cross-chain "not selling" is still selling, technically.',
    emoji: '🌉',
    label: 'Bridge Life',
  },
];

/**
 * Build personalized dashboard content based on user preferences.
 */
export function buildDashboardContent(preferences) {
  const assets = preferences?.assets || ['Bitcoin', 'Ethereum'];
  const investorType = preferences?.investorType || 'HODLer';
  const contentTypes = preferences?.contentTypes || ['Market News', 'Charts', 'AI Insights'];

  // Coin Prices — prioritize selected assets, then add others
  const priorityCoins = assets
    .map((a) => ALL_PRICES[a])
    .filter(Boolean);
  const otherCoins = Object.values(ALL_PRICES).filter(
    (c) => !assets.includes(c.name)
  );
  const coinPrices = priorityCoins;

  // Market News — prioritize news tagged with selected assets
  const priorityNews = ALL_NEWS.filter((n) =>
    n.tags.some((tag) => assets.includes(tag))
  );
  const otherNews = ALL_NEWS.filter(
    (n) => !n.tags.some((tag) => assets.includes(tag))
  );
  const marketNews = [...priorityNews, ...otherNews].slice(0, 5);

  // AI Insight — pick based on investor type
  const insights = ALL_INSIGHTS[investorType] || ALL_INSIGHTS['HODLer'];
  const aiInsight = insights[Math.floor(Math.random() * insights.length)];

  // Meme — random
  const meme = MEMES[Math.floor(Math.random() * MEMES.length)];

  return {
    coinPrices,
    marketNews,
    aiInsight,
    meme,
    meta: {
      investorType,
      selectedAssets: assets,
      contentTypes,
      generatedAt: new Date().toISOString(),
    },
  };
}
