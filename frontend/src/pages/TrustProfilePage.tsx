import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { TrustProfile, User, Listing } from '../types';
import { TrustScoreCard } from '../components/TrustScoreCard';
import { ArrowLeft, ShieldCheck, MapPin } from 'lucide-react';

interface TrustProfilePageProps {
  userId: string;
  navigate: (path: string) => void;
}

export const TrustProfilePage: React.FC<TrustProfilePageProps> = ({ userId, navigate }) => {
  const [data, setData] = useState<{
    user: User;
    trust_profile: TrustProfile;
    active_listings: Listing[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/profile/${userId}`)
      .then((res) => setData(res))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Loading member profile...</div>;
  }

  if (!data) {
    return <div className="text-center py-24 text-slate-500">User not found.</div>;
  }

  const { user, trust_profile, active_listings } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <button
        onClick={() => navigate('/marketplace')}
        className="inline-flex items-center space-x-1 text-sm font-semibold text-slate-600 hover:text-teal-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* User Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md"
            style={{ backgroundColor: user.avatar_color || '#0f766e' }}
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-900">{user.name}</h1>
              {user.verified && (
                <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Identity</span>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
              <span>{user.city || 'Verified User'}</span>
              <span>•</span>
              <span>Member on Accord</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Trust Profile Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          <TrustScoreCard profile={trust_profile} />
        </div>

        {/* User Active Listings */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Active Marketplace Listings ({active_listings.length})
          </h3>
          <div className="space-y-3">
            {active_listings.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/listing/${item.id}`)}
                className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition cursor-pointer flex items-center space-x-3 group"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-teal-700 transition">
                    {item.title}
                  </h4>
                  <div className="text-xs font-black text-slate-900 mt-0.5">
                    ₹{item.price.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {item.category} • {item.condition}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
