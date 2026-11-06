import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { DisputeDetail, EvidenceItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  Upload,
  User,
  AlertCircle,
} from 'lucide-react';

interface DisputeWorkspacePageProps {
  disputeId: string;
  navigate: (path: string) => void;
}

export const DisputeWorkspacePage: React.FC<DisputeWorkspacePageProps> = ({
  disputeId,
  navigate,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidenceText, setEvidenceText] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // Support Agent Resolution state
  const [resolveNote, setResolveNote] = useState('');
  const [resolutionType, setResolutionType] = useState('partial_refund');
  const [resolving, setResolving] = useState(false);

  const loadDispute = async () => {
    try {
      const res = await apiFetch<DisputeDetail>(`/disputes/${disputeId}`);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDispute();
  }, [disputeId]);

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceText.trim() || submittingEvidence) return;

    setSubmittingEvidence(true);
    try {
      await apiFetch(`/disputes/${disputeId}/evidence`, {
        method: 'POST',
        body: JSON.stringify({ text: evidenceText.trim() }),
      });
      setEvidenceText('');
      loadDispute();
    } catch (err: any) {
      alert(err.message || 'Evidence submission failed');
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleResolveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveNote.trim() || resolving) return;

    setResolving(true);
    try {
      await apiFetch(`/disputes/${disputeId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          resolution: resolutionType,
          note: resolveNote.trim(),
        }),
      });
      alert('Dispute has been resolved.');
      loadDispute();
    } catch (err: any) {
      alert(err.message || 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Loading dispute workspace...</div>;
  }

  if (!data) {
    return <div className="text-center py-24 text-slate-500">Dispute not found.</div>;
  }

  const { dispute, summary, deal, listing, commitments, relevant_messages, evidence } = data;
  const isSupport = user?.role === 'support';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/disputes')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                DISPUTE #{dispute.code}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {dispute.status.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">{dispute.issue}</h1>
          </div>
        </div>

        <button
          onClick={() => navigate(`/chat/${deal.id}`)}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs"
        >
          View Full Chat History →
        </button>
      </div>

      {/* AI Case Summary & Structured Evidence Dossier (Mandatory USP) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Automated Evidence Dossier & Case Summary
              </h3>
              <p className="text-xs text-slate-400">
                Assembled automatically from recorded chat promises, order details, and party submissions.
              </p>
            </div>
          </div>

          {summary.ai_generated && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              AI Assisted Summary
            </span>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50">
          {/* Fact Comparison Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Commitment vs. Observed Value
            </span>

            {summary.facts?.commitment ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Seller Commitment:</span>
                  <div className="text-sm font-bold text-slate-900">
                    {summary.facts.commitment.label}: {summary.facts.commitment.seller_stated}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Buyer-Reported Value:</span>
                  <div className="text-sm font-bold text-rose-600">
                    {dispute.reported_value || 'Reported discrepancy'}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  Status:{' '}
                  <span className="font-semibold text-rose-700">
                    {summary.facts.commitment.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No single commitment linked.</p>
            )}
          </div>

          {/* Assessment */}
          <div className="md:col-span-2 p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Evidence Assessment
            </span>
            <p className="text-xs text-slate-800 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
              {summary.assessment}
            </p>

            <div className="flex items-center space-x-2 text-xs text-slate-600 font-semibold">
              <span className="text-slate-400">Suggested Next Action:</span>
              <span className="text-teal-700">{summary.suggested_next_action}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Layout: Evidence Stream (Left) & Deal Ledger Context (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Submissions & Case Evidence (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-900">Submitted Evidence & Statements</h3>

            {/* Evidence items timeline */}
            <div className="space-y-4">
              {evidence.map((item) => (
                <div key={item.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 uppercase">
                      {item.role} ({item.kind})
                    </span>
                    <span className="text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Evidence Submission Form */}
            {dispute.status !== 'resolved' && (
              <form onSubmit={handleAddEvidence} className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Submit Additional Statement / Evidence
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide additional context or clarify the observed condition..."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-600 focus:bg-white focus:outline-none"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingEvidence}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {submittingEvidence ? 'Submitting...' : 'Add Statement'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Support Resolution Form if user is support lead */}
          {isSupport && dispute.status !== 'resolved' && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-purple-900">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
                <h3 className="text-base font-bold">Support Agent Adjudication</h3>
              </div>
              <p className="text-xs text-purple-800">
                AI assists by organizing evidence, but the final decision is strictly human-verified.
              </p>

              <form onSubmit={handleResolveCase} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-purple-900 uppercase">
                    Resolution Decision
                  </label>
                  <select
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="partial_refund">Partial Refund to Buyer (Recommended for battery discrepancy)</option>
                    <option value="refund_buyer">Full Refund to Buyer & Return Item</option>
                    <option value="release_to_seller">Release Escrow to Seller (Commitment Met)</option>
                    <option value="no_action">Close Case without Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-purple-900 uppercase">
                    Official Support Adjudication Note
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document the exact reason and adjustment amount agreed upon..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    className="w-full mt-1 p-3 bg-white border border-purple-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={resolving}
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  {resolving ? 'Applying Resolution...' : 'Finalize & Execute Dispute Resolution'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Original Deal Ledger & Chat Context (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Linked Deal Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase text-slate-400">
                Linked Deal Ledger
              </span>
              <span className="font-mono text-xs text-teal-700 font-bold">#{deal.code}</span>
            </div>

            <div className="space-y-2">
              {commitments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    c.status === 'discrepancy'
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">{c.label}</div>
                    <div className="text-slate-600">Stated: {c.value}</div>
                    {c.reported_value && (
                      <div className="text-rose-700 font-semibold mt-0.5">
                        Reported: {c.reported_value}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      c.status === 'discrepancy'
                        ? 'bg-rose-200 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Chat Record Snips */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold uppercase text-slate-400">
              Relevant Verified Messages
            </span>
            <div className="space-y-2 text-xs">
              {relevant_messages.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{m.sender_id === deal.seller.id ? 'Seller' : 'Buyer'}</span>
                    <span>{new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-800 font-medium">"{m.body}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
