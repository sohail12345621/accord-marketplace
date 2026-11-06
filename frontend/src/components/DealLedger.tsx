import React from 'react';
import { CommitmentItem } from '../types';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  FileCheck2,
} from 'lucide-react';

interface DealLedgerProps {
  dealCode: string;
  commitments: CommitmentItem[];
  agreedPrice: number | null;
  state: string;
  userRole: 'buyer' | 'seller' | 'support';
  onReportDiscrepancy?: (commitment: CommitmentItem) => void;
  onConfirmPending?: (commitmentId: string) => void;
  onRejectPending?: (commitmentId: string) => void;
}

export const DealLedger: React.FC<DealLedgerProps> = ({
  dealCode,
  commitments,
  agreedPrice,
  state,
  userRole,
  onReportDiscrepancy,
  onConfirmPending,
  onRejectPending,
}) => {
  const sellerCommitments = commitments.filter((c) => c.party === 'seller');
  const buyerCommitments = commitments.filter((c) => c.party === 'buyer');

  const activeCount = commitments.filter((c) =>
    ['active', 'fulfilled', 'discrepancy'].includes(c.status)
  ).length;

  const discrepancies = commitments.filter((c) => c.status === 'discrepancy');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold tracking-wider text-teal-400 uppercase">
              Deal Ledger
            </span>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
              #{dealCode}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            Structured Conversation Commitments
          </h3>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{activeCount} tracked</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Alert Banner if any */}
      {discrepancies.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <span className="font-bold">⚠ Commitment discrepancy active: </span>
            {discrepancies.map((d) => (
              <span key={d.id} className="block mt-0.5">
                {d.label}: Seller committed <span className="font-semibold underline">{d.value}</span>, reported as <span className="font-semibold underline">{d.reported_value}</span>.
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Commitments body */}
      <div className="p-4 sm:p-5 space-y-6 flex-1 overflow-y-auto max-h-[600px]">
        {/* Seller Commitments Section */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Seller Commitments
            </span>
            <span className="text-[11px] text-slate-400">
              Extracted from verified chat
            </span>
          </div>

          {sellerCommitments.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center italic bg-slate-50 rounded-xl">
              No seller commitments detected yet. Promises made in chat will appear here automatically.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sellerCommitments.map((c) => {
                const isDiscrepant = c.status === 'discrepancy';
                const isFulfilled = c.status === 'fulfilled';
                const isPending = c.status === 'pending';

                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border transition ${
                      isDiscrepant
                        ? 'border-rose-300 bg-rose-50/60'
                        : isPending
                        ? 'border-amber-200 bg-amber-50/40'
                        : isFulfilled
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2.5">
                        <div className="mt-0.5">
                          {isDiscrepant ? (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          ) : isFulfilled ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isPending ? (
                            <Clock className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {c.label}
                            </span>
                            {c.origin === 'ai_extracted' && (
                              <span className="inline-flex items-center text-[10px] text-teal-700 bg-teal-100/70 px-1.5 py-0.2 rounded font-medium">
                                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                AI Extracted
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-700 mt-0.5">
                            Seller stated:{' '}
                            <span className="font-semibold text-slate-900">
                              {c.value}
                            </span>
                          </div>

                          {c.reported_value && (
                            <div className="text-xs text-rose-700 font-medium mt-0.5">
                              Reported value: {c.reported_value}
                            </div>
                          )}

                          {c.source_text && (
                            <p className="text-[11px] text-slate-500 mt-1 italic line-clamp-1">
                              "{c.source_text}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Discrepancy report button for Buyer if active */}
                      {userRole === 'buyer' && !isDiscrepant && ['PAID', 'FULFILLMENT_PENDING', 'FULFILLED', 'DISPUTED'].includes(state) && onReportDiscrepancy && (
                        <button
                          onClick={() => onReportDiscrepancy(c)}
                          className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-rose-600 hover:underline px-2 py-1 rounded bg-white border border-slate-200"
                        >
                          Verify / Report
                        </button>
                      )}

                      {/* Confirmation buttons if pending */}
                      {isPending && onConfirmPending && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onConfirmPending(c.id)}
                            className="text-[11px] font-medium px-2 py-0.5 rounded bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Add
                          </button>
                          {onRejectPending && (
                            <button
                              onClick={() => onRejectPending(c.id)}
                              className="text-[11px] font-medium px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200"
                            >
                              Ignore
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buyer Commitments Section */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Buyer Commitments
            </span>
            <span className="text-[11px] text-slate-400">Agreed price & terms</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/30 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Agreed Escrow Price
                  </div>
                  <div className="text-xs text-slate-600">
                    {agreedPrice ? `₹${agreedPrice.toLocaleString()}` : 'Negotiation in progress'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                {agreedPrice ? 'Locked' : 'Pending'}
              </span>
            </div>

            {buyerCommitments
              .filter((c) => c.attribute !== 'agreed_price')
              .map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{c.label}</div>
                      <div className="text-xs text-slate-600">{c.value}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Footer reassurance */}
      <div className="bg-slate-50 p-3.5 border-t border-slate-200 text-center">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Every promise made above is legally preserved for dispute resolution</span>
        </p>
      </div>
    </div>
  );
};
