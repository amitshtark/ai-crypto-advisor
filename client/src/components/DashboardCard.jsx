import VoteButtons from './VoteButtons';

export default function DashboardCard({ title, children, section, itemId }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
        {section && <VoteButtons section={section} itemId={itemId} />}
      </div>
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
