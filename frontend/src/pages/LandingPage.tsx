import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { Listing } from '../types';
import {
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);

  useEffect(() => {
    apiFetch<{ items: Listing[] }>('/listings?limit=4')
      .then((data) => setFeaturedListings(data.items || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 bg-gradient-to-b from-teal-50/60 via-white to-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-teal-100/80 text-teal-800 text-xs font-semibold mb-6 border border-teal-200">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>Accord Conversational Marketplace MVP</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
            Where marketplace conversations become{' '}
            <span className="text-teal-700 underline decoration-teal-300 decoration-wavy underline-offset-8">
              accountable agreements.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Every promise made in a marketplace conversation becomes part of the deal. Accord turns buyer-seller chat commitments into a structured Deal Ledger, preventing disputes and making resolution evidence-driven.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-lg shadow-teal-600/25 flex items-center justify-center space-x-2 transition"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('how-it-works');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-300 transition"
            >
              See How Accord Works
            </button>
          </div>

          {/* Interactive Core USP Visualization Card */}
          <div className="mt-14 max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-left">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between text-xs">
              <span className="font-mono text-teal-400 font-semibold">THE ACCORD PROMISE ENGINE</span>
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Real-Time Extraction</span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  1. Seller states in chat:
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm text-slate-800 italic">
                  "Battery health is 92%, original charger included, no repairs at all."
                </div>
                <div className="text-[11px] text-teal-700 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Powered by Nexconn Chat SDK real-time message stream</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>2. Accord creates Deal Ledger:</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-teal-200 shadow-sm text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-700">
                    <span>• Battery Health:</span>
                    <span className="font-bold text-emerald-700">92%</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>• Included Item:</span>
                    <span className="font-bold text-emerald-700">Original Charger</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>• Repair History:</span>
                    <span className="font-bold text-emerald-700">No Repairs</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-rose-50/70 border-t border-rose-100 p-4 flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  If buyer later reports <strong>Battery Health 81%</strong>, Accord flags an instant <strong>Commitment Discrepancy</strong> with full cryptographic chat evidence.
                </span>
              </div>
              <button
                onClick={() => navigate('/dispute/disp_demo_iphone')}
                className="shrink-0 ml-4 font-bold text-rose-700 hover:underline"
              >
                View Demo Dispute →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories / Featured Used Electronics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Featured Used Electronics</h2>
            <p className="text-sm text-slate-500 mt-1">
              Every listing backed by explainable trust scores and chat-based commitment guarantees.
            </p>
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredListings.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/listing/${item.id}`)}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col"
            >
              <div className="h-48 overflow-hidden bg-slate-100 relative">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold">
                  {item.category}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-teal-700 transition">
                    {item.title}
                  </h3>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    ₹{item.price.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <span>{item.condition}</span>
                    <span>•</span>
                    <span>{item.location}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Seller Trust</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {item.seller.trust?.score || 92} / 100
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works / 6 Steps */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">The Workflow</span>
          <h2 className="text-3xl font-bold text-slate-900 mt-1">From Casual Chat to Binding Agreement</h2>
          <p className="text-slate-600 text-sm mt-2">
            No more buried promises or subjective disputes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-base">Real-Time Nexconn Chat</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Buyers and sellers negotiate over official Nexconn messaging infrastructure. Fast, persistent, and secure.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-base">Automatic Commitment Extraction</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Accord identifies promises (battery health, repair status, warranty, included chargers) directly from message text.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-base">Living Deal Ledger</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Promises are locked into an immutable ledger linked to the deal code. Both parties see what is agreed before payment.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              4
            </div>
            <h3 className="font-bold text-slate-900 text-base">Transaction State Machine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Agreed → Escrow Paid → Fulfillment → Received. State transitions are strictly verified and enforced by backend rules.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              5
            </div>
            <h3 className="font-bold text-slate-900 text-base">Delivery Verification</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upon receipt, the buyer verifies each commitment. If a specification does not match, a discrepancy is logged instantly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-base">
              6
            </div>
            <h3 className="font-bold text-slate-900 text-base">Dispute Workspace with Evidence</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Disputes assemble original chat records, listing specs, and photos automatically. AI generates a neutral case summary for human support.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
