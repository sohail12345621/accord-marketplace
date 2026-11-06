# Accord — Conversational Marketplace Platform

> **“Every promise made in a marketplace conversation becomes part of the deal.”**

Accord is a conversational marketplace platform built for used electronics. Its core innovation is solving the problem of marketplace agreements buried inside unstructured buyer-seller conversations:

When a dispute occurs, users and support teams typically have to manually reconstruct what was promised. Accord solves this by **detecting transaction-relevant commitments directly from conversation streams, structuring them into a Deal Ledger, tracking fulfillment milestones, and leveraging chat evidence to accelerate support and dispute resolution.**

---

## 🌟 The Core Differentiator: The Accord Workflow

```text
Marketplace Listing
        ↓
Buyer-Seller Conversation (Nexconn Real-Time Chat SDK)
        ↓
Commitment Detection (Battery health, accessories, repair history, shipping)
        ↓
Deal Ledger (Structured, locked agreement linked to deal code)
        ↓
Transaction (Escrow State Machine: AGREED → PAID → FULFILLED)
        ↓
Delivery Verification (Buyer checks commitments on received item)
        ↓
Support / Dispute Resolution (Automated evidence assembly & AI summary)
```

### Real-World Example
1. **Seller states in chat:**
   > *"Battery health is 92%, original charger included, no repairs at all."*
2. **Accord extracts and adds to Deal Ledger:**
   - `Battery Health`: `92%`
   - `Included Item`: `Original charger`
   - `Repair History`: `No repairs`
3. **Buyer receives item and reports:**
   > *"Battery health is 81%."*
4. **Accord automatically triggers:**
   - `SELLER COMMITMENT`: `92%`
   - `REPORTED VALUE`: `81%`
   - `STATUS`: `⚠ Commitment discrepancy`
   - Assembles chat history, listing specs, and buyer statement into the Dispute Workspace for instant human adjudication.

---

## 🚀 Key Features

- **Real-Time Nexconn Chat**: Official integration using the `@nexconn/chat` and `@nexconn/engine` Web SDKs for direct buyer-seller messaging, read receipts, and typing indicators.
- **Strict Security Architecture**: `NEXCONN_APP_SECRET` **never touches the frontend**. All token issuance and SHA1 webhook verification occurs strictly on the backend.
- **Living Deal Ledger**: Real-time agreement card embedded beside the chat with active, fulfilled, and discrepancy status badges.
- **Explainable Trust Score**: 100% deterministic score (0–100) based on verified identity, completed transactions, dispute history, and commitments kept (never a generic AI score).
- **Scam & Risk Detection**: Defends against off-platform payments (UPI, bank transfer), advance fee requests, and urgency pressure.
- **Dispute Workspace**: Automated case dossier aggregating original chat quotes, listing specifications, and party evidence with AI case assessments.
- **Deterministic AI Abstraction**: Uses provider-agnostic JSON completions with strict anti-hallucination guardrails and fallback local execution.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Lucide icons.
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2.
- **Messaging**: Nexconn Chat SDK (Direct Channels, Connection Handlers, Typings).
- **Database**: SQLite for zero-setup local dev; PostgreSQL (`psycopg3`) ready for production.

---

## ⚡ Quickstart & Local Development

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate   # On Windows (or source .venv/bin/activate on Unix)
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```
Backend runs at `http://localhost:8000`. API docs available at `/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 💬 Nexconn Chat SDK Configuration

Accord utilizes the official **Nexconn Chat SDK** (`@nexconn/chat@26.2.1`) for persistent, real-time marketplace messaging.

### 1. Environment Architecture

| Environment | Variable | Purpose | Security |
|---|---|---|---|
| **Frontend** | `VITE_NEXCONN_APP_KEY` | Public App Key for SDK client initialization | Safe for browser bundle |
| **Backend** | `NEXCONN_APP_KEY` | Server-side API key | Server only |
| **Backend** | `NEXCONN_APP_SECRET` | Secret used to sign token requests & verify webhooks | **NEVER exposed to frontend** |
| **Backend** | `NEXCONN_API_BASE` | Primary API endpoint (`https://api.sg-light-api.com`) | Server only |
| **Backend** | `NEXCONN_AREA` | Data center area code (`SG` or `NA`) | Server only |

### 2. User Identity & Token Exchange Flow
1. **Deterministic User Mapping**: Every Accord user ID maps directly to a deterministic Nexconn identity: `accord_<user_id>`.
2. **Safe Token Exchange**: When a user authenticates in Accord, the frontend requests `GET /api/chat/token`. The backend uses `NEXCONN_APP_SECRET` to compute the required SHA1 signature `sha1(AppSecret + Nonce + Timestamp)` and requests a user token via `POST /v4/auth/access-token/issue`.
3. **Single Lifecycle Manager**: The frontend singleton `NexconnManager` (`frontend/src/services/nexconn.ts`) connects when a user logs in, cleanly disconnects on logout, and handles instant session teardown/reconnection during user switching.
4. **Server Webhook Verification**: `POST /api/chat/webhook` verifies the incoming `Signature` header before ingesting messages into the Deal Ledger and triggering commitment extraction.
5. **Zero Setup Fallback**: If Nexconn credentials are omitted during development, Accord automatically defaults to local transport mode without errors.

---

## 🔑 Demo Personas & Credentials
The application automatically seeds realistic demo data on launch. Password for all demo accounts:

**`AccordDemo2026!`**

| Role | Email | Name | Focus |
|---|---|---|---|
| **Buyer** | `buyer@accord.demo` | Aarav Sharma | Testing purchasing, negotiation, reporting discrepancies |
| **Seller** | `seller@accord.demo` | Vikramaditya Rao | Listing items, making promises, offering resolutions |
| **Support** | `support@accord.demo` | Accord Support | Reviewing dispute evidence dossiers, executing settlements |

*Use the quick demo switcher in the top navigation bar to switch between personas in one click.*

---

## 🔒 Security & Defense in Depth
- **Zero Client Secrets**: `NEXCONN_APP_SECRET`, JWT keys, and AI keys are strictly backend environment variables.
- **IDOR / BOLA Prevention**: Every endpoint enforces resource ownership (`User + (Buyer | Seller | Support)`).
- **Input Sanitization & Magic Bytes**: Dispute file uploads enforce magic-byte header inspection and safe file renaming.
- **Rate Limiting**: Sliding-window limiter on sensitive auth and API endpoints.

---

## 📜 License
MIT License.
