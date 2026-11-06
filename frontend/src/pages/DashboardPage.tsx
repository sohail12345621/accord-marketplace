import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TrustScoreCard } from '../components/TrustScoreCard';
import { TrustProfile } from '../types';
import {
  LayoutDashboard,
  ShieldCheck,
  Package,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface DashboardPageProps {
  navigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<{
    metrics: {
      active_deals: number;
      completed_deals: number;
      open_disputes: number;
      active_listings: number;
      trust_score: number;
      trust_band: string;
    };
    trust_profile: TrustProfile;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/dashboard/overview')
      .then((res) => setData(res))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="text-center py-24 text-slate-500">Dashboard unavailable.</div>;
  }

  const { metrics, trust_profile } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">User Dashboard</h1>
        <p className="text-slate-600 text-sm mt-1">
          Welcome back, {user?.name}. Manage your accountable marketplace agreements, escrow milestones, and trust score.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Active Deals</span>
            <MessageSquare className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.active_deals}</div>
          <p className="text-[11px] text-slate-500">Conversations with tracked commitments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Completed Deals</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.completed_deals}</div>
          <p className="text-[11px] text-slate-500">Successfully fulfilled & verified</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Open Disputes</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.open_disputes}</div>
          <p className="text-[11px] text-slate-500">Cases under support adjudication</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Trust Score</span>
            <ShieldCheck className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.trust_score} / 100</div>
          <p className="text-[11px] text-emerald-700 font-semibold">{metrics.trust_band}</p>
        </div>
      </div>

      {/* Trust Profile & Shortcuts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Your Explainable Reputation Profile</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Accord's trust score is 100% deterministic and transparent. No opaque AI rating; your reputation is calculated directly from fulfilled commitments, dispute track record, and verified identity.
            </p>
            <TrustScoreCard profile={trust_profile} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/marketplace')}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-900 text-xs font-semibold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span>Browse Used Electronics</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/chat')}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-900 text-xs font-semibold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span>Open Active Conversations</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/disputes')}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-900 text-xs font-semibold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span>Check Dispute Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
