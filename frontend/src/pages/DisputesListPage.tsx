import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { AlertTriangle, ArrowRight, Clock, ShieldAlert } from 'lucide-react';

interface DisputesListPageProps {
  navigate: (path: string) => void;
}

export const DisputesListPage: React.FC<DisputesListPageProps> = ({ navigate }) => {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any[]>('/disputes')
      .then((data) => setDisputes(data || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dispute Resolution Workspace</h1>
        <p className="text-slate-600 text-sm mt-1">
          Evidence-driven dispute resolution combining verified conversation promises, listing specifications, and delivery evidence.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 space-y-3">
          <p className="text-slate-500 font-medium text-sm">No open disputes. All commitments fulfilled smoothly!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((disp) => (
            <div
              key={disp.id}
              onClick={() => navigate(`/dispute/${disp.id}`)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
            >
              <div className="flex items-start space-x-3.5">
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-rose-600">
                      #{disp.code}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                      {disp.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Deal #{disp.deal_code}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-1 group-hover:text-rose-600 transition">
                    {disp.issue}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {disp.description || 'Dispute regarding item condition / commitment fulfillment.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
                <div className="text-right text-xs">
                  <span className="text-slate-400">Created:</span>
                  <div className="font-medium text-slate-700">
                    {new Date(disp.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-rose-50 text-slate-400 group-hover:text-rose-600 transition">
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
