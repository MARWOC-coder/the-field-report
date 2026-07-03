import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Login, { Standby } from './pages/Login';
import LogPage from './pages/LogPage';
import BoardPage from './pages/BoardPage';
import TeamPage from './pages/TeamPage';
import MePage from './pages/MePage';
import AdminPage from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

function Gate() {
  const { session, profile, signOut } = useAuth();

  if (session === undefined || (session && profile === null)) {
    return <div className="loading-page"><span className="spin" /></div>;
  }
  if (!session) return <Login />;
  if (profile.status !== 'active') return <Standby onSignOut={signOut} />;

  const isAdmin = profile.role === 'admin';
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="shell">
        <Routes>
          <Route path="/" element={<LogPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
