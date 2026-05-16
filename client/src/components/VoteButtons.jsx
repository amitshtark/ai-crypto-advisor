import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '../api/api';

export default function VoteButtons({ section, itemId }) {
  const [voteStatus, setVoteStatus] = useState(null); // 'up', 'down', or null
  const [loading, setLoading] = useState(false);

  const handleVote = async (vote) => {
    if (voteStatus === vote || loading) return;
    
    setLoading(true);
    try {
      await api.submitFeedback({ section, itemId, vote });
      setVoteStatus(vote);
    } catch (err) {
      console.error('Failed to submit feedback', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button
        onClick={() => handleVote('up')}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          color: voteStatus === 'up' ? 'var(--success)' : 'var(--text-muted)',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s'
        }}
        title="Helpful"
      >
        <ThumbsUp size={20} className={voteStatus === 'up' ? 'fill-current' : ''} />
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          color: voteStatus === 'down' ? 'var(--danger)' : 'var(--text-muted)',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s'
        }}
        title="Not Helpful"
      >
        <ThumbsDown size={20} className={voteStatus === 'down' ? 'fill-current' : ''} />
      </button>
    </div>
  );
}
