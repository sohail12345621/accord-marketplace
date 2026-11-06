import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  MessageSquare,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface DealsAndOrdersPageProps {
  navigate: (path: string) => void;
  scope?: 'all' | 'orders';
}

export const DealsAndOrdersPage: React.FC<DealsAndOrdersPageProps> = ({
  navigate,
  scope = 'all',
}) => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any[]>(`/deals?scope=${scope}`)
      .then((data) => setDeals(data || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {scope === 'orders' ? 'Orders & Escrow Transactions' : 'Conversations & Active Deals'}
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Every conversation below automatically extracts transaction commitments and syncs them to your Deal Ledger.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading conversations...</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 space-y-4">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium text-sm">No conversations found.</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            Explore Marketplace
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map((d) => (
            <div
              key={d.id}
              onClick={() => navigate(`/chat/${d.id}`)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={d.listing.image_url}
                    alt={d.listing.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-teal-700">#{d.code}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                      {d.state.replace('_', ' ')}
                    </span>
                    {d.role === 'buyer' ? (
                      <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-1.5 py-0.5 rounded">
                        You are Buyer
                      </span>
                    ) : (
                      <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded">
                        You are Seller
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-0.5 group-hover:text-teal-700 transition">
                    {d.listing.title}
                  </h3>

                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                    <span>With {d.counterpart.name}</span>
                    <span>•</span>
                    <span>
                      {d.agreed_price
                        ? `Agreed: ₹${d.agreed_price.toLocaleString()}`
                        : `Asking: ₹${d.listing.price.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="text-right">
                  <div className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{d.commitment_count || 0} Commitments</span>
                  </div>
                  {d.unread > 0 && (
                    <span className="block mt-1 text-[11px] font-bold text-teal-700">
                      {d.unread} new messages
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-teal-50 text-slate-400 group-hover:text-teal-700 transition">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
