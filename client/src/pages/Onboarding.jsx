import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

const ASSET_OPTIONS = [
  'Bitcoin', 'Ethereum', 'Solana', 'Dogecoin', 'Cardano',
  'Polygon', 'Binance Coin', 'XRP', 'Litecoin', 'Avalanche'
];
const INVESTOR_OPTIONS = ['HODLer', 'Day Trader', 'NFT Collector', 'DeFi Explorer', 'Beginner'];
const CONTENT_OPTIONS = ['Market News', 'Charts', 'Fun', 'AI Insights'];

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedAssets, setSelectedAssets] = useState([]);
  const [investorType, setInvestorType] = useState('');
  const [contentTypes, setContentTypes] = useState([]);

  const toggleSelection = (set, current, value) => {
    if (current.includes(value)) {
      set(current.filter(item => item !== value));
    } else {
      set([...current, value]);
    }
  };

  const handleSubmit = async () => {
    if (selectedAssets.length === 0) return setError('Please select at least one asset.');
    if (!investorType) return setError('Please select an investor type.');
    if (contentTypes.length === 0) return setError('Please select at least one content type.');

    setError('');
    setLoading(true);
    try {
      await api.savePreferences({
        assets: selectedAssets,
        investorType,
        contentTypes
      });
      // Update local context
      setUser({ ...user, hasOnboarded: true });
      navigate('/dashboard');
    } catch (err) {
      try {
        const errObj = JSON.parse(err.message);
        setError(errObj.error || 'Failed to save preferences');
      } catch {
        setError('Failed to save preferences');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderButtons = (options, currentSelections, setFunc, isMulti = true) => {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
        {options.map(opt => {
          const isSelected = isMulti ? currentSelections.includes(opt) : currentSelections === opt;
          return (
            <button
              key={opt}
              className="btn"
              style={{
                backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-dark)',
                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                color: isSelected ? 'white' : 'var(--text-main)',
              }}
              onClick={() => isMulti ? toggleSelection(setFunc, currentSelections, opt) : setFunc(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Personalize Your Experience</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Tell us about your crypto journey so we can tailor your dashboard.
        </p>

        {error && (
          <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <h4>What crypto assets are you interested in?</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select all that apply.</p>
        {renderButtons(ASSET_OPTIONS, selectedAssets, setSelectedAssets)}

        <h4>What type of investor are you?</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select one.</p>
        {renderButtons(INVESTOR_OPTIONS, investorType, setInvestorType, false)}

        <h4>What kind of content would you like to see?</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select all that apply.</p>
        {renderButtons(CONTENT_OPTIONS, contentTypes, setContentTypes)}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Complete Onboarding'}
        </button>
      </div>
    </div>
  );
}
