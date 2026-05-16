import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // If user hasn't onboarded and isn't on the onboarding page, redirect
  if (!user.hasOnboarded && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has onboarded and tries to go to onboarding, redirect to dashboard
  if (user.hasOnboarded && window.location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex-center min-h-screen">Loading...</div>;
  if (user) {
    return <Navigate to={user.hasOnboarded ? "/dashboard" : "/onboarding"} replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
