import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Listing, TrustProfile } from '../types';
import { TrustScoreCard } from '../components/TrustScoreCard';
import {
  ShieldCheck,
  MessageSquare,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface ListingDetailPageProps {
  listingId: string;
  navigate: (path: string) => void;
}

export const ListingDetailPage: React.FC<ListingDetailPageProps> = ({ listingId, navigate }) => {
  const { user, switchDemoUser } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);

  // Ask Accord Assistant states
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askResult, setAskResult] = useState<{
    points: string[];
    sources: string[];
    ai_summary?: string;
    ai_generated: boolean;
  } | null>(null);

  useEffect(() => {
    apiFetch<Listing>(`/listings/${listingId}`)
      .then((data) => setListing(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [listingId]);

  const handleStartChat = async () => {
    if (!user) {
      await switchDemoUser('buyer');
    }
    setStartingChat(true);
    try {
      const deal = await apiFetch<{ id: string }>(`/listings/${listingId}/conversation`, {
        method: 'POST',
      });
      navigate(`/chat/${deal.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start conversation');
    } finally {
      setStartingChat(false);
    }
  };

  const handleAskAccord = async (presetQuestion?: string) => {
    const q = presetQuestion || askQuery;
    if (!q.trim()) return;

    if (!user) {
      await switchDemoUser('buyer');
    }

    setAskLoading(true);
    try {
      const res = await apiFetch<{
        points: string[];
        sources: string[];
        ai_summary?: string;
        ai_generated: boolean;
      }>(`/listings/${listingId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      });
      setAskResult(res);
    } catch (e: any) {
      alert(e.message || 'Assistant query failed');
    } finally {
      setAskLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Loading listing details...</div>;
  }

  if (!listing) {
    return <div className="text-center py-24 text-slate-500">Listing not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/marketplace')}
        className="inline-flex items-center space-x-1 text-sm font-semibold text-slate-600 hover:text-teal-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Photos & Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Photo Card */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="h-96 w-full bg-slate-100 relative">
              <img
                src={listing.image_url}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold">
                {listing.category}
              </span>
              <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 text-xs font-bold shadow-sm">
                {listing.condition}
              </span>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                  {listing.title}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-slate-500 mt-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{listing.location}</span>
                  <span>•</span>
                  <span>Views: {listing.views || 1}</span>
                </div>
              </div>

              {/* Price card on mobile */}
              <div className="lg:hidden flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500">Asking Price</span>
                  <div className="text-2xl font-black text-slate-900">
                    ₹{listing.price.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={handleStartChat}
                  disabled={startingChat}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition"
                >
                  {startingChat ? 'Connecting...' : 'Start Conversation'}
                </button>
              </div>

              {/* Description */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Seller Description
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  {listing.description || 'No description provided.'}
                </p>
              </div>

              {/* Specifications Grid */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Technical Specifications
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(listing.specs || {}).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-600">{key}</span>
                      <span className="font-bold text-slate-900">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ask Accord AI Assistant Section */}
              <div className="bg-gradient-to-br from-teal-50/70 to-slate-50 border border-teal-200/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Ask Accord Intelligence</h3>
                    <p className="text-xs text-slate-500">
                      Grounded guidance based only on actual listing facts & category comparables (no hallucinations).
                    </p>
                  </div>
                </div>

                {/* Preset quick questions */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'Is this price reasonable?',
                    'What should I ask the seller?',
                    'What risks should I check before buying?',
                    'Which specifications are missing?',
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleAskAccord(preset)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-teal-100/60 text-teal-800 border border-teal-200 shadow-2xs transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Custom query input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about this listing..."
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAccord()}
                    className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    onClick={() => handleAskAccord()}
                    disabled={askLoading}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {askLoading ? 'Analyzing...' : 'Ask'}
                  </button>
                </div>

                {/* Results display */}
                {askResult && (
                  <div className="mt-4 p-4 rounded-xl bg-white border border-teal-200 space-y-3">
                    {askResult.ai_summary && (
                      <div className="text-xs text-slate-800 leading-relaxed font-medium bg-teal-50/50 p-3 rounded-lg border border-teal-100">
                        {askResult.ai_summary}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Fact-checked Points:
                      </span>
                      {askResult.points.map((pt, i) => (
                        <div key={i} className="text-xs text-slate-700 flex items-start space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Sources: {askResult.sources?.join(', ') || 'Accord Verified Data'}</span>
                      {askResult.ai_generated && (
                        <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded">
                          AI Assisted Analysis
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Action Box & Seller Trust Profile */}
        <div className="space-y-6">
          {/* Purchase / Conversation Box */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Listed Price
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                ₹{listing.price.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Protected by Accord Escrow & Deal Ledger</span>
              </div>
            </div>

            <button
              onClick={handleStartChat}
              disabled={startingChat}
              className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{startingChat ? 'Opening Channel...' : 'Talk to Seller'}</span>
            </button>

            <div className="text-[11px] text-slate-500 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="font-semibold text-slate-700">How this works:</div>
              <p>1. Start real-time chat with the seller over Nexconn.</p>
              <p>2. Any specifications or promises made will be auto-extracted into the Deal Ledger.</p>
              <p>3. Funds stay in escrow until you receive and verify the item.</p>
            </div>
          </div>

          {/* Seller Trust Profile Card */}
          {listing.seller_trust ? (
            <TrustScoreCard profile={listing.seller_trust} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="text-xs font-bold uppercase text-slate-400">Seller Profile</span>
              <div className="flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: listing.seller.avatar_color || '#0f766e' }}
                >
                  {listing.seller.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{listing.seller.name}</h4>
                  <p className="text-xs text-slate-500">{listing.seller.city || 'Verified User'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
