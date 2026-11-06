import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
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

export function App() {
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

  // Simple client router
  const renderRoute = () => {
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
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
