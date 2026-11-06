export interface User {
  id: string;
  name: string;
  email?: string;
  city: string;
  avatar_color: string;
  role: 'user' | 'support';
  verified: boolean;
  member_since?: string;
  chat_id?: string;
  trust?: {
    score: number;
    band: string;
  };
}

export interface TrustFactor {
  name: string;
  points: number;
  max: number;
}

export interface TrustReason {
  ok: boolean;
  text: string;
}

export interface TrustProfile {
  score: number;
  band: string;
  reasons: TrustReason[];
  factors: TrustFactor[];
  method: string;
}

export interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  condition: string;
  location: string;
  image_url: string;
  description?: string;
  specs: Record<string, string>;
  history?: Array<{ at: string; event: string }>;
  status: string;
  created_at: string;
  views?: number;
  seller: User;
  seller_trust?: TrustProfile;
}

export interface MessageItem {
  id: string;
  deal_id: string;
  sender_id: string | null;
  kind: 'text' | 'system';
  body: string;
  nexconn_message_id?: string | null;
  transport: 'nexconn' | 'local' | 'seed';
  risk_level: 'none' | 'low' | 'medium' | 'high';
  risk_reasons: string[];
  sent_at: string;
}

export interface CommitmentItem {
  id: string;
  deal_id: string;
  message_id?: string | null;
  party: 'seller' | 'buyer';
  type: 'PRODUCT_ATTRIBUTE' | 'INCLUDED_ITEM' | 'FULFILLMENT' | 'PRICE' | 'CONDITION' | 'WARRANTY';
  attribute: string;
  label: string;
  value: string;
  source_text: string;
  confidence: number;
  origin: 'ai_extracted' | 'confirmed' | 'manual';
  status: 'pending' | 'active' | 'fulfilled' | 'discrepancy' | 'rejected' | 'superseded';
  reported_value?: string | null;
  due_at?: string | null;
  created_at: string;
}

export interface DealAction {
  to: string;
  label: string;
}

export interface DealDetail {
  id: string;
  code: string;
  state: string;
  role: 'buyer' | 'seller' | 'support';
  agreed_price: number | null;
  proposed_price: number | null;
  proposed_by: string | null;
  listing: {
    id: string;
    title: string;
    price: number;
    image_url: string;
    category: string;
  };
  counterpart: User & { chat_id: string };
  buyer: User;
  seller: User;
  last_message_at: string;
  created_at: string;
  commitments: CommitmentItem[];
  events: Array<{ from: string; to: string; note: string; at: string }>;
  actions: DealAction[];
  can_dispute: boolean;
  dispute: { id: string; code: string; status: string } | null;
  counterpart_trust: TrustProfile;
  listing_full: {
    specs: Record<string, string>;
    condition: string;
    location: string;
  };
}

export interface EvidenceItem {
  id: string;
  role: 'buyer' | 'seller' | 'support';
  kind: 'statement' | 'file' | 'note';
  text: string;
  file_name?: string | null;
  file_mime?: string | null;
  created_at: string;
  submitted_by: string;
}

export interface DisputeDetail {
  dispute: {
    id: string;
    code: string;
    deal_id: string;
    deal_code: string;
    issue: string;
    description: string;
    reported_value: string | null;
    status: 'open' | 'awaiting_seller' | 'under_review' | 'resolved';
    resolution: string | null;
    resolution_note: string;
    commitment_id: string | null;
    opened_by: string;
    listing_title: string;
    created_at: string;
    updated_at: string;
  };
  role: 'buyer' | 'seller' | 'support';
  summary: {
    assessment: string;
    facts: any;
    evidence_list: string[];
    suggested_next_action: string;
    evidence_gaps: string[];
    risk_flags: string[];
    ai_generated: boolean;
  };
  deal: {
    id: string;
    code: string;
    state: string;
    agreed_price: number | null;
    buyer: User;
    seller: User;
  };
  listing: Listing;
  commitments: CommitmentItem[];
  relevant_messages: MessageItem[];
  evidence: EvidenceItem[];
}
