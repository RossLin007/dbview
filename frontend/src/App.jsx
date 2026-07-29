import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RecordList from './components/RecordList';
import RecordDetails from './components/RecordDetails';
import SmartSQLQuery from './components/SmartSQLQuery';
import MemberProfiles from './components/MemberProfiles';
import Analytics from './components/Analytics';
import LoginModal from './components/LoginModal';
import ForbiddenModal from './components/ForbiddenModal';
import { AuthProvider, useAuth } from './AuthContext';

function MainApp() {
  const { user, loading, session } = useAuth();
  const [activeTab, setActiveTab] = useState('sql');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  
  // Stats shared with sidebar and analytics dashboard
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(null);

  // 403 白名单鉴权拦截状态
  const [isForbidden, setIsForbidden] = useState(false);
  const [forbiddenMsg, setForbiddenMsg] = useState('');

  const fetchStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    setErrorStats(null);
    setIsForbidden(false);
    
    try {
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/analytics', { headers });

      if (response.status === 403) {
        const data = await response.json();
        setIsForbidden(true);
        setForbiddenMsg(data.message || '您的账号未获访问白名单授权。');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch analytics statistics');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setErrorStats(err.message);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, session]);

  // When changing tabs, automatically reset details panel to view list
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'meetings') {
      setSelectedRecordId(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-primary)'
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  if (isForbidden) {
    return (
      <ForbiddenModal
        forbiddenMessage={forbiddenMsg}
        onRetry={fetchStats}
      />
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        stats={stats}
        loadingStats={loadingStats}
      />
      
      <main className="main-content">
        {activeTab === 'sql' && <SmartSQLQuery />}

        {activeTab === 'members' && <MemberProfiles />}

        {activeTab === 'meetings' && (
          selectedRecordId ? (
            <RecordDetails
              recordId={selectedRecordId}
              onBack={() => setSelectedRecordId(null)}
            />
          ) : (
            <RecordList
              onSelectRecord={(id) => setSelectedRecordId(id)}
            />
          )
        )}

        {activeTab === 'analytics' && (
          <Analytics
            stats={stats}
            loadingStats={loadingStats}
            errorStats={errorStats}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
