import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  MessageSquare,
  Package,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Sparkles,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const { user, logout, switchDemoUser } = useAuth();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2.5 text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:bg-teal-700 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-teal-700 transition">
                Accord
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/60">
                Verified Commitments
              </span>
            </div>
          </button>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => navigate('/marketplace')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                currentPath.startsWith('/marketplace') || currentPath.startsWith('/listing')
                  ? 'bg-slate-100 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Marketplace
            </button>
            {user && (
              <>
                <button
                  onClick={() => navigate('/chat')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                    currentPath.startsWith('/chat')
                      ? 'bg-slate-100 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    Conversations
                  </span>
                </button>
                <button
                  onClick={() => navigate('/orders')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                    currentPath === '/orders'
                      ? 'bg-slate-100 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    Orders & Deals
                  </span>
                </button>
                <button
                  onClick={() => navigate('/disputes')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                    currentPath.startsWith('/dispute')
                      ? 'bg-slate-100 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Disputes
                  </span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User / Demo switcher */}
        <div className="flex items-center space-x-3">
          {/* Quick Demo Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDemoOpen(!demoOpen)}
              className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
              title="Switch demo persona for testing"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Demo Role: {user ? (user.role === 'support' ? 'Support' : user.name.split(' ')[0]) : 'Guest'}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {demoOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">
                  Switch Test Persona
                </div>
                <button
                  onClick={async () => {
                    await switchDemoUser('buyer');
                    setDemoOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                    <div>
                      <div className="font-semibold text-slate-800">Aarav (Buyer)</div>
                      <div className="text-[10px] text-slate-400">buyer@accord.demo</div>
                    </div>
                  </div>
                  {user?.email === 'buyer@accord.demo' && <span className="text-teal-600 font-bold">✓</span>}
                </button>

                <button
                  onClick={async () => {
                    await switchDemoUser('seller');
                    setDemoOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-teal-600"></div>
                    <div>
                      <div className="font-semibold text-slate-800">Vikram (Seller)</div>
                      <div className="text-[10px] text-slate-400">seller@accord.demo</div>
                    </div>
                  </div>
                  {user?.email === 'seller@accord.demo' && <span className="text-teal-600 font-bold">✓</span>}
                </button>

                <button
                  onClick={async () => {
                    await switchDemoUser('support');
                    setDemoOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                    <div>
                      <div className="font-semibold text-slate-800">Accord Support</div>
                      <div className="text-[10px] text-slate-400">support@accord.demo</div>
                    </div>
                  </div>
                  {user?.email === 'support@accord.demo' && <span className="text-teal-600 font-bold">✓</span>}
                </button>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: user.avatar_color || '#0f766e' }}
                >
                  {user.name.charAt(0)}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{user.name}</span>
              </button>

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => switchDemoUser('buyer')}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
            >
              Sign In (Demo)
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
