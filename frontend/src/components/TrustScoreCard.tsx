import React from 'react';
import { TrustProfile } from '../types';
import { ShieldCheck, Check, AlertCircle, Info } from 'lucide-react';

interface TrustScoreCardProps {
  profile: TrustProfile;
  compact?: boolean;
}

export const TrustScoreCard: React.FC<TrustScoreCardProps> = ({ profile, compact = false }) => {
  const isHigh = profile.score >= 80;
  const isMed = profile.score >= 60 && profile.score < 80;

  const badgeColor = isHigh
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isMed
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-50 text-slate-700 border-slate-200';

  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${badgeColor}`}>
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{profile.score}/100</span>
        <span className="text-slate-400">•</span>
        <span>{profile.band}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Explainable Trust Score
          </span>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <span className="text-2xl font-black text-slate-900">{profile.score}</span>
            <span className="text-xs text-slate-500 font-medium">/ 100</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {profile.band}
            </span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-slate-400'
          }`}
          style={{ width: `${profile.score}%` }}
        />
      </div>

      {/* Deterministic Reasons */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Why this score:
        </span>
        <ul className="space-y-1.5">
          {profile.reasons.map((r, i) => (
            <li key={i} className="text-xs text-slate-700 flex items-start space-x-2">
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold ${
                  r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {r.ok ? '✓' : '•'}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Methodology note */}
      <div className="text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start space-x-1.5">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>{profile.method}</span>
      </div>
    </div>
  );
};
