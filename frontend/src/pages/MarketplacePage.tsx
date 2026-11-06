import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { Listing } from '../types';
import { Search, Filter, ShieldCheck, MapPin, Tag, Smartphone, Laptop, Cpu, Gamepad2, Camera, Headphones } from 'lucide-react';

interface MarketplacePageProps {
  navigate: (path: string) => void;
}

const CATEGORIES = [
  { name: 'All', icon: Tag },
  { name: 'Smartphones', icon: Smartphone },
  { name: 'Laptops', icon: Laptop },
  { name: 'GPUs', icon: Cpu },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'Cameras', icon: Camera },
  { name: 'Accessories', icon: Headphones },
];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({ navigate }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (conditionFilter) params.append('condition', conditionFilter);
      params.append('sort', sortOrder);

      const res = await apiFetch<{ items: Listing[] }>(`/listings?${params.toString()}`);
      setListings(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedCategory, conditionFilter, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Used Electronics Marketplace</h1>
        <p className="text-slate-600 text-sm mt-1">
          Browse verified electronics where seller descriptions and chat promises become legally accountable deal commitments.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search phones, laptops, GPUs, shutter count..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">All Conditions</option>
            <option value="Like New">Like New</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          Loading listings...
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500 font-medium text-sm">No listings found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/listing/${item.id}`)}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col"
            >
              <div className="h-52 overflow-hidden bg-slate-100 relative">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold">
                  {item.category}
                </span>
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-md text-slate-800 text-[11px] font-medium shadow-sm">
                  {item.condition}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="text-xl font-black text-slate-900 mt-2">
                    ₹{item.price.toLocaleString()}
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </div>

                  {/* Top specifications pills */}
                  {item.specs && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(item.specs).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: item.seller.avatar_color || '#0f766e' }}
                    >
                      {item.seller.name.charAt(0)}
                    </span>
                    <span className="text-slate-700 font-medium">{item.seller.name}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{item.seller.trust?.score || 92}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
