import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { nexconn, NexconnConnectionState } from '../services/nexconn';
import { DealDetail, MessageItem, CommitmentItem } from '../types';
import { DealLedger } from '../components/DealLedger';
import { ScamWarningBanner } from '../components/ScamWarningBanner';
import {
  Send,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Tag,
  CreditCard,
  Package,
  CheckCircle,
  HelpCircle,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface ChatPageProps {
  dealId: string;
  navigate: (path: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ dealId, navigate }) => {
  const { user } = useAuth();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputBody, setInputBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connState, setConnState] = useState<NexconnConnectionState>('idle');
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  // Proposal modal state
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState<number>(0);

  // Discrepancy report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedCommitment, setSelectedCommitment] = useState<CommitmentItem | null>(null);
  const [reportedValue, setReportedValue] = useState('');

  // Support case recommendation card
  const [assistCard, setAssistCard] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Fetch deal data & messages
  const loadDealAndMessages = async () => {
    try {
      const [dealData, msgsData] = await Promise.all([
        apiFetch<DealDetail>(`/deals/${dealId}`),
        apiFetch<{ items: MessageItem[] }>(`/deals/${dealId}/messages?limit=60`),
      ]);
      setDeal(dealData);
      setMessages(msgsData.items || []);
      setProposePrice(dealData.proposed_price || dealData.listing.price);
      // Mark read
      apiFetch(`/deals/${dealId}/read`, { method: 'POST' }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to load deal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDealAndMessages();
  }, [dealId]);

  // Subscribe to central Nexconn manager events
  useEffect(() => {
    const unsubStatus = nexconn.subscribeStatus((st) => setConnState(st));

    const unsubMsg = nexconn.subscribeMessages((msg) => {
      // In a production direct channel, remote incoming messages arrive here
      // Reload messages to get full risk analysis + commitments from backend
      loadDealAndMessages();
    });

    const unsubTyping = nexconn.subscribeTyping((d) => {
      if (deal && d.userId === deal.counterpart.chat_id) {
        setOtherIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherIsTyping(false), 5000);
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [deal]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherIsTyping]);

  // Handle Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputBody.trim() || sending || !deal) return;

    const text = inputBody.trim();
    setInputBody('');
    setSending(true);

    try {
      // 1. Send via real-time Nexconn Direct Channel
      const nexRes = await nexconn.sendDirectMessage(deal.counterpart.chat_id, text);

      // 2. Ingest into Accord backend to run commitment extraction, risk engine & Deal Ledger
      const ingestRes = await apiFetch<{
        message: MessageItem;
        risk: any;
        commitments_added: CommitmentItem[];
        commitments_pending: CommitmentItem[];
        assist: any;
      }>(`/deals/${dealId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: text,
          nexconn_message_id: nexRes.messageId || null,
        }),
      });

      // Update state with newly persisted message
      setMessages((prev) => [...prev, ingestRes.message]);

      if (ingestRes.assist) {
        setAssistCard(ingestRes.assist);
      }

      // Reload deal to refresh updated Deal Ledger and state transitions
      const refreshed = await apiFetch<DealDetail>(`/deals/${dealId}`);
      setDeal(refreshed);
    } catch (err: any) {
      alert(err.message || 'Send message failed');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputBody(e.target.value);
    if (deal) {
      nexconn.sendTyping(deal.counterpart.chat_id);
    }
  };

  // State machine transition
  const handleTransition = async (toState: string) => {
    try {
      const updated = await apiFetch<DealDetail>(`/deals/${dealId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to: toState }),
      });
      setDeal(updated);
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Transition failed');
    }
  };

  // Propose price
  const handlePropose = async () => {
    if (!proposePrice || proposePrice <= 0) return;
    try {
      const updated = await apiFetch<DealDetail>(`/deals/${dealId}/propose`, {
        method: 'POST',
        body: JSON.stringify({ price: proposePrice }),
      });
      setDeal(updated);
      setProposeOpen(false);
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Propose price failed');
    }
  };

  // Accept proposal
  const handleAcceptProposal = async () => {
    try {
      const updated = await apiFetch<DealDetail>(`/deals/${dealId}/accept`, {
        method: 'POST',
      });
      setDeal(updated);
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Accept failed');
    }
  };

  // Report discrepancy modal submit
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommitment || !reportedValue.trim()) return;

    try {
      await apiFetch(`/commitments/${selectedCommitment.id}/report`, {
        method: 'POST',
        body: JSON.stringify({ value: reportedValue.trim() }),
      });
      setReportModalOpen(false);
      setReportedValue('');
      setSelectedCommitment(null);
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message || 'Report failed');
    }
  };

  // Confirm pending commitment into ledger
  const handleConfirmPending = async (cid: string) => {
    try {
      await apiFetch(`/commitments/${cid}/confirm`, { method: 'POST' });
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectPending = async (cid: string) => {
    try {
      await apiFetch(`/commitments/${cid}/reject`, { method: 'POST' });
      loadDealAndMessages();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Loading conversation...</div>;
  }

  if (!deal) {
    return <div className="text-center py-24 text-slate-500">Deal not found.</div>;
  }

  const isBuyer = deal.role === 'buyer';
  const otherUser = deal.counterpart;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/chat')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">{otherUser.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600 border border-slate-200">
                #{deal.code}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                {deal.state.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
              <span>Listing:</span>
              <button
                onClick={() => navigate(`/listing/${deal.listing.id}`)}
                className="font-medium text-teal-700 hover:underline"
              >
                {deal.listing.title} (₹{deal.listing.price.toLocaleString()})
              </button>
            </div>
          </div>
        </div>

        {/* Nexconn Real-time Status Indicator Pill */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
            {connState === 'connected' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-emerald-800">Nexconn Real-Time Live</span>
              </>
            ) : connState === 'connecting' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-slate-600">Connecting Nexconn...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-slate-600 font-medium">Accord Real-Time Active</span>
              </>
            )}
          </div>

          {/* Quick Dispute shortcut if available */}
          {deal.can_dispute && (
            <button
              onClick={() => {
                const issue = prompt('Describe the issue or discrepancy with the delivered item:');
                if (issue) {
                  apiFetch(`/deals/${dealId}/disputes`, {
                    method: 'POST',
                    body: JSON.stringify({ issue }),
                  })
                    .then((res) => navigate(`/dispute/${res.id}`))
                    .catch((err) => alert(err.message));
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center space-x-1 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Open Dispute</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid: Left Chat Area (60%), Right Deal Ledger (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Chat Conversation Stream */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[700px]">
          {/* Action Bar / Offer Negotiations Bar */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Deal Status:</span>
              <span className="font-mono font-bold text-teal-800">{deal.state}</span>
              {deal.agreed_price && (
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Agreed ₹{deal.agreed_price.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* If pending proposal from other party */}
              {deal.proposed_price && deal.proposed_by !== deal.role && deal.state !== 'AGREED' && (
                <button
                  onClick={handleAcceptProposal}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition"
                >
                  Accept ₹{deal.proposed_price.toLocaleString()} Offer
                </button>
              )}

              {/* Propose price button */}
              {['CONVERSATION_STARTED', 'NEGOTIATING'].includes(deal.state) && (
                <button
                  onClick={() => setProposeOpen(true)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-lg transition"
                >
                  Propose Price
                </button>
              )}

              {/* Transition actions */}
              {deal.actions.map((act) => (
                <button
                  key={act.to}
                  onClick={() => handleTransition(act.to)}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-xs transition"
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* In-chat Assist Banner if triggered */}
          {assistCard && (
            <div className="bg-teal-50 border-b border-teal-200 p-3.5 flex items-start justify-between text-xs text-teal-900">
              <div className="space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  <span>{assistCard.title}</span>
                </div>
                <p className="text-teal-800">
                  Seller committed: <span className="font-bold">{assistCard.committed}</span>
                  {assistCard.reported && <span> | Reported: <span className="font-bold">{assistCard.reported}</span></span>}
                </p>
              </div>

              {assistCard.kind === 'discrepancy' && (
                <button
                  onClick={() => {
                    const issue = `Discrepancy: ${assistCard.label} (Committed: ${assistCard.committed}, Reported: ${assistCard.reported})`;
                    apiFetch(`/deals/${dealId}/disputes`, {
                      method: 'POST',
                      body: JSON.stringify({
                        issue,
                        commitment_id: assistCard.commitment_id,
                        reported_value: assistCard.reported,
                      }),
                    })
                      .then((res) => navigate(`/dispute/${res.id}`))
                      .catch((err) => alert(err.message));
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 transition"
                >
                  File Dispute Case
                </button>
              )}
            </div>
          )}

          {/* Message History Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              const isSystem = m.kind === 'system' || !m.sender_id;

              if (isSystem) {
                return (
                  <div key={m.id} className="text-center my-3">
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/80">
                      {m.body}
                    </span>
                  </div>
                );
              }

              const hasHighRisk = m.risk_level === 'high' || m.risk_level === 'medium';

              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Scam / Risk Warning Banner directly under suspicious message */}
                  {hasHighRisk && (
                    <div className="max-w-md w-full">
                      <ScamWarningBanner
                        reasons={m.risk_reasons}
                        onReport={() => {
                          apiFetch(`/messages/${m.id}/report`, {
                            method: 'POST',
                            body: JSON.stringify({ reason: 'Flagged high risk' }),
                          })
                            .then(() => alert('Thank you. Message has been reported to Accord Trust & Safety.'))
                            .catch((err) => alert(err.message));
                        }}
                      />
                    </div>
                  )}

                  <div
                    className={`max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-2xs ${
                      isMe
                        ? 'bg-teal-700 text-white rounded-br-xs'
                        : hasHighRisk
                        ? 'bg-amber-50 text-slate-900 border border-amber-300 rounded-bl-xs'
                        : 'bg-slate-100 text-slate-900 rounded-bl-xs'
                    }`}
                  >
                    <p>{m.body}</p>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1 px-1">
                    <span>
                      {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {m.transport === 'nexconn' && <span>• Nexconn</span>}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {otherIsTyping && (
              <div className="text-xs text-slate-400 italic flex items-center space-x-1 py-1">
                <span>{otherUser.name} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder={`Message ${otherUser.name}... (Try: "Battery health is 92%" or "Original charger included")`}
              value={inputBody}
              onChange={handleInputChange}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={sending || !inputBody.trim()}
              className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md disabled:opacity-40 transition cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Right Column: Deal Ledger (The Non-Negotiable USP) */}
        <div className="lg:col-span-5 space-y-6">
          <DealLedger
            dealCode={deal.code}
            commitments={deal.commitments}
            agreedPrice={deal.agreed_price}
            state={deal.state}
            userRole={deal.role}
            onReportDiscrepancy={(c) => {
              setSelectedCommitment(c);
              setReportedValue(c.value);
              setReportModalOpen(true);
            }}
            onConfirmPending={handleConfirmPending}
            onRejectPending={handleRejectPending}
          />

          {/* Quick Counterpart Trust Profile */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {otherUser.name} ({deal.role === 'buyer' ? 'Seller' : 'Buyer'})
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Trust Score: {deal.counterpart_trust.score} / 100
              </span>
            </div>
            <p className="text-slate-500">
              {deal.counterpart_trust.reasons.find((r) => r.ok)?.text || 'Verified member on Accord'}
            </p>
          </div>
        </div>
      </div>

      {/* Propose Price Modal */}
      {proposeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Propose Agreed Price</h3>
            <p className="text-xs text-slate-500">
              When accepted by the {deal.role === 'buyer' ? 'seller' : 'buyer'}, this price is locked into the Deal Ledger.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700">Amount (INR)</label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={proposePrice}
                  onChange={(e) => setProposePrice(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setProposeOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handlePropose}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm"
              >
                Send Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification / Report Discrepancy Modal */}
      {reportModalOpen && selectedCommitment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Verify Commitment</h3>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500 font-medium">Original Seller Promise:</div>
              <div className="font-bold text-slate-900">
                {selectedCommitment.label}: {selectedCommitment.value}
              </div>
              <div className="text-[11px] text-slate-400 italic">"{selectedCommitment.source_text}"</div>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Observed / Verified Value on Received Item
                </label>
                <input
                  type="text"
                  placeholder="e.g. 81% or Missing or Damaged"
                  value={reportedValue}
                  onChange={(e) => setReportedValue(e.target.value)}
                  className="w-full mt-1 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  If this differs from what the seller promised, a discrepancy flag will be raised on the Deal Ledger.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
                >
                  Submit Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
