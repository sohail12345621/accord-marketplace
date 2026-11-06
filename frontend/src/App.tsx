import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { ChatPage } from './pages/ChatPage';
import { DealsAndOrdersPage } from './pages/DealsAndOrdersPage';
import { DisputesListPage } from './pages/DisputesListPage';
import { DisputeWorkspacePage } from './pages/DisputeWorkspacePage';
import { DashboardPage } from './pages/DashboardPage';
import { TrustProfilePage } from './pages/TrustProfilePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Protected route enforcement
  const isProtectedPath = (path: string) => {
    return (
      path === '/chat' ||
      path.startsWith('/chat/') ||
      path === '/orders' ||
      path.startsWith('/deal/') ||
      path === '/disputes' ||
      path.startsWith('/dispute/') ||
      path === '/dashboard' ||
      path === '/profile'
    );
  };

  // Prevent flash of unauthenticated / race conditions
  if (loading && isProtectedPath(currentPath)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Checking session...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if unauthenticated on protected route
  if (!loading && !user && isProtectedPath(currentPath)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Navbar currentPath={currentPath} navigate={navigate} />
        <main className="flex-1">
          <LoginPage navigate={navigate} redirectUrl={currentPath} />
        </main>
      </div>
    );
  }

  const renderRoute = () => {
    if (currentPath === '/login') {
      return <LoginPage navigate={navigate} />;
    }
    if (currentPath === '/register') {
      return <RegisterPage navigate={navigate} />;
    }
    if (currentPath === '/') {
      return <LandingPage navigate={navigate} />;
    }
    if (currentPath === '/marketplace') {
      return <MarketplacePage navigate={navigate} />;
    }
    if (currentPath.startsWith('/listing/')) {
      const id = currentPath.split('/listing/')[1];
      return <ListingDetailPage listingId={id} navigate={navigate} />;
    }
    if (currentPath === '/chat') {
      return <DealsAndOrdersPage navigate={navigate} scope="all" />;
    }
    if (currentPath.startsWith('/chat/')) {
      const id = currentPath.split('/chat/')[1];
      return <ChatPage dealId={id} navigate={navigate} />;
    }
    if (currentPath === '/orders') {
      return <DealsAndOrdersPage navigate={navigate} scope="orders" />;
    }
    if (currentPath === '/disputes') {
      return <DisputesListPage navigate={navigate} />;
    }
    if (currentPath.startsWith('/dispute/')) {
      const id = currentPath.split('/dispute/')[1];
      return <DisputeWorkspacePage disputeId={id} navigate={navigate} />;
    }
    if (currentPath === '/dashboard') {
      return <DashboardPage navigate={navigate} />;
    }
    if (currentPath.startsWith('/profile/')) {
      const id = currentPath.split('/profile/')[1];
      return <TrustProfilePage userId={id} navigate={navigate} />;
    }
    return <LandingPage navigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar currentPath={currentPath} navigate={navigate} />
      <main className="flex-1">{renderRoute()}</main>

      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-semibold text-slate-700">
            Accord — Where marketplace conversations become accountable agreements.
          </p>
          <p className="text-slate-400">
            Built with Nexconn Chat SDK real-time direct channels, FastAPI, and verifiable Deal Ledgers.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
