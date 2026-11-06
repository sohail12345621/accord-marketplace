import React from 'react';
import { AlertOctagon, Flag, ShieldAlert } from 'lucide-react';

interface ScamWarningBannerProps {
  reasons: string[];
  onReport?: () => void;
  onDismiss?: () => void;
}

export const ScamWarningBanner: React.FC<ScamWarningBannerProps> = ({
  reasons,
  onReport,
  onDismiss,
}) => {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm my-2 text-slate-800">
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              ⚠ Potential Risk Detected
            </h4>
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-200/80 text-amber-900 rounded font-semibold">
              Safeguard Alert
            </span>
          </div>

          <p className="text-xs text-amber-800 mt-1">
            This message contains signals commonly associated with marketplace fraud or off-platform payment diversion.
          </p>

          <ul className="mt-2 space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="text-xs text-amber-900 font-medium flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>{r}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center space-x-2">
            {onReport && (
              <button
                onClick={onReport}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report Seller</span>
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-medium transition"
              >
                I Understand, Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
