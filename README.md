<div align="center">

# ⚡ Razorpay MCP Agent
### Autonomous AI Merchant Operations, Live Tool Calling & Real-Time Payment Intelligence

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol_2.0-8A2BE2?style=for-the-badge&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Live_API-0C2340?style=for-the-badge&logo=razorpay&logoColor=3395FF)](https://razorpay.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_%26_Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![GSAP](https://img.shields.io/badge/GSAP-Animations-88CE02?style=for-the-badge&logo=greensock&logoColor=white)](https://greensock.com/gsap/)

<br />

**Razorpay MCP Agent** is an enterprise-grade, autonomous payment operations and merchant support platform. Built on the open **Model Context Protocol (MCP)** specification, it seamlessly interfaces **Google Gemini 2.5 Flash** with **Razorpay's Live REST API**. 

From autonomous payment investigations and failure code diagnosis, to instant order creation, dynamic UPI QR generation, scannable in-chat checkout, and real-time HMAC-verified webhook triage — Razorpay MCP Agent transforms payment workflows into conversational intelligence.

[Explore Features](#-key-features) • [Architecture Diagrams](#-system-architecture) • [Flowcharts](#-workflow-flowcharts) • [MCP Tool Catalog](#-mcp-tool-catalog) • [Getting Started](#-getting-started) • [MCP Configuration](#-running-the-mcp-server)

---

</div>

## 📑 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Workflow Flowcharts](#-workflow-flowcharts)
  - [1. High-Level System Architecture](#1-high-level-system-architecture)
  - [2. Conversational MCP Tool-Calling Loop](#2-conversational-mcp-tool-calling-loop)
  - [3. Real-Time Webhook Ingestion & AI Triage Pipeline](#3-real-time-webhook-ingestion--ai-triage-pipeline)
  - [4. Payment Recovery & Dynamic UPI QR Code Generation](#4-payment-recovery--dynamic-upi-qr-code-generation)
  - [5. Multimodal Invoice & Evidence Ingestion Engine](#5-multimodal-invoice--evidence-ingestion-engine)
  - [6. Dual-Transport MCP Server Architecture](#6-dual-transport-mcp-server-architecture)
- [Key Features](#-key-features)
  - [Autonomous AI Engine (Dual LLM Core)](#1-autonomous-ai-engine-dual-llm-core)
  - [Live Model Context Protocol (MCP) Protocol](#2-live-model-context-protocol-mcp-protocol)
  - [Real-Time Webhook Automation & Instant Triage](#3-real-time-webhook-automation--instant-triage)
  - [In-Chat Razorpay Checkout & Dynamic UPI QRs](#4-in-chat-razorpay-checkout--dynamic-upi-qrs)
  - [Multimodal Evidence & Document Analysis](#5-multimodal-evidence--document-analysis)
  - [Live MCP Data Explorer](#6-live-mcp-data-explorer)
  - [Firebase Cloud Persistence](#7-firebase-cloud-persistence)
- [MCP Tool Catalog](#-mcp-tool-catalog)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Running the MCP Server (Stdio Mode)](#-running-the-mcp-server-stdio-mode)
  - [Claude Desktop Configuration](#claude-desktop-configuration)
  - [Cursor / Antigravity IDE Configuration](#cursor--antigravity-ide-configuration)
- [Testing & Automation Scripts](#-testing--automation-scripts)
- [Security & Compliance](#-security--compliance)
- [Author & Credits](#-author--credits)

---

## 🌟 Overview

Operating modern payment gateways demands constant vigilance: tracking down failed transactions, diagnosing esoteric bank decline codes, responding to chargeback disputes before tight deadlines, refunding unhappy customers, and generating checkout links.

**Razorpay MCP Agent** solves this by establishing a direct bridge between conversational AI agents and Razorpay:

1. **Zero Guesswork / No Mock Data:** Connects directly to official Razorpay endpoints (`/v1/payments`, `/v1/orders`, `/v1/refunds`, `/v1/settlements`, `/v1/payment_links`).
2. **Standardized Protocol:** Leverages the open **Model Context Protocol (MCP)** specification so any MCP-compliant client (web UI, CLI, Claude Desktop, Cursor, Antigravity) can manage payments identically.
3. **Automated Cart Recovery:** Detects payment failure webhooks in milliseconds, consults the AI engine to generate customer-friendly retry notifications, and auto-spins UPI QR codes and payment links.
4. **Interactive In-Chat Execution:** Users can inspect orders, view real-time breakdown tables, click to open the official Razorpay Checkout modal without leaving the chat, or scan dynamically generated UPI QR codes on their mobile phones.

---

## 🏛️ System Architecture

The application is structured into four primary tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                │
│   React 19 + TypeScript + Vite + Tailwind CSS v4 + Shadcn UI + GSAP        │
│   • Interactive Chat Interface      • Live MCP Data Explorer                │
│   • Webhook Automation Suite        • Dynamic UPI QR & Checkout Modal       │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌─────────────────────────────────┐       ┌───────────────────────────────────┐
│     AI ORCHESTRATION LAYER      │       │     CLOUD PERSISTENCE LAYER       │
│  • Google Gemini 2.5 Flash      │       │  • Firebase Authentication        │
│  • Dynamic Function Calling     │       │  • Cloud Firestore Sessions       │
│  • Real-Time Tool Execution     │       │  • Real-Time Chat Synchronization │
└───────────────┬─────────────────┘       └───────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MODEL CONTEXT PROTOCOL (MCP) LAYER                      │
│   • Stdio Transport MCP Server (@modelcontextprotocol/sdk)                  │
│   • In-Browser MCP Client with Vite Reverse Proxy (/api/razorpay)           │
│   • 8+ Standardized Tools (Payments, Orders, Refunds, Links, Settlements)   │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RAZORPAY INTEGRATION TIER                          │
│   • Live Razorpay REST API (v1)      • Webhook Ingestion Engine             │
│   • Standard Checkout.js Modal       • HMAC-SHA256 Signature Verification   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Workflow Flowcharts

### 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client["🖥️ Client Tier (Browser)"]
        UI["React 19 SPA<br/>(Dashboard / Chat / Explorer)"]
        Renderer["Markdown Renderer<br/>(UPI QR & Checkout Buttons)"]
        HookUI["Webhook Automation Suite<br/>(Event Simulator & Feed)"]
    end

    subgraph Orchestrator["🧠 AI Orchestration Tier"]
        Gemini["Google Gemini 2.5 Flash<br/>(Function Calling & Tool Dispatcher)"]
    end

    subgraph MCP["🔌 Model Context Protocol (MCP) Tier"]
        StdioMCP["MCP Stdio Server<br/>(mcp-server/index.mjs)"]
        ClientMCP["MCP Web Client<br/>(src/services/mcpClient.ts)"]
        ToolList["MCP Tools:<br/>• get_payment • list_payments<br/>• get_order • create_order<br/>• create_payment_link • get_refunds"]
    end

    subgraph RazorpayGateway["💳 Razorpay Core & Banking Tier"]
        RzpAPI["Razorpay REST API v1<br/>(api.razorpay.com)"]
        RzpCheckout["Razorpay Checkout.js<br/>(Native Modal)"]
        WebhookIn["Vite Webhook Middleware<br/>(/api/webhooks/razorpay)"]
    end

    subgraph Persistence["🔥 Persistence Tier"]
        FBAuth["Firebase Auth<br/>(Google & Email/Password)"]
        Firestore["Cloud Firestore<br/>(Sessions & Message History)"]
    end

    UI --> Gemini
    Gemini --> ToolList
    ToolList --> ClientMCP
    ToolList --> StdioMCP
    ClientMCP --> RzpAPI
    StdioMCP --> RzpAPI
    Renderer --> RzpCheckout
    RzpCheckout -.->|Triggers Event| WebhookIn
    WebhookIn -->|Stream Event| UI
    UI <--> Firestore
    UI <--> FBAuth
```

---

### 2. Conversational MCP Tool-Calling Loop

```mermaid
sequenceDiagram
    autonumber
    actor Merchant as 👨‍💼 Merchant / Support User
    participant UI as 💬 Chat Interface (React)
    participant LLM as 🤖 LLM (Google Gemini 2.5 Flash)
    participant MCP as 🔌 Razorpay MCP Client
    participant RZP as 💳 Razorpay Live API

    Merchant->>UI: "What's the status of order order_TXGPnb2izSqLLF?"
    UI->>LLM: Send message history + available MCP Tool Schemas
    Note over LLM: LLM detects intent & invokes get_order_details(order_id: "order_TXGPnb2izSqLLF")
    LLM-->>UI: Return Function Call Request (Tool Name + Args)
    UI->>MCP: Execute mcpGetOrder("order_TXGPnb2izSqLLF")
    MCP->>RZP: GET https://api.razorpay.com/v1/orders/order_TXGPnb2izSqLLF
    RZP-->>MCP: 200 OK (amount: 149900, status: "created", amount_due: 149900)
    MCP-->>UI: Formatted JSON Result { status: "created", due: "₹1,499.00" }
    UI->>LLM: Send Tool Execution Result back to LLM context
    Note over LLM: Synthesizes live data into actionable markdown with payment recommendations
    LLM-->>UI: Markdown Response with Status Table & Action Options
    UI-->>Merchant: Displays clean status card with "Generate Payment Link" prompt
```

---

### 3. Real-Time Webhook Ingestion & AI Triage Pipeline

```mermaid
flowchart TD
    Start(["⚡ Webhook Event Occurs<br/>(e.g., payment.failed, order.paid)"]) --> Ingest["Incoming POST<br/>/api/webhooks/razorpay"]
    
    Ingest --> SigCheck{"Verify Signature?<br/>x-razorpay-signature"}
    SigCheck -- "HMAC-SHA256 Mismatch" --> Reject["❌ 400 Bad Request<br/>Log Security Anomaly"]
    SigCheck -- "Verified / Dev Mode" --> Buffer["Store in Rolling Memory Buffer<br/>(Last 50 Events)"]

    Buffer --> EventType{"Event Type"}

    EventType -- "order.paid / payment.captured" --> PaidFlow["🟢 Paid Event Detected"]
    PaidFlow --> TriagePaid["AI Triage: Generate Order Fulfillment Advice<br/>& Tax Invoice Recommendation"]
    TriagePaid --> PushPaid["Broadcast Celebration Card into Active Chat<br/>Status: CAPTURED | Amount Paid"]

    EventType -- "payment.failed" --> FailFlow["🔴 Failure Event Detected"]
    FailFlow --> TriageFail["AI Triage: Extract error_code & error_description<br/>(e.g., BAD_REQUEST_ERROR / Bank Decline)"]
    TriageFail --> GenRecovery["Formulate Recovery Message & Actionable Advisory<br/>'Customer entered wrong OTP. Send UPI retry link.'"]
    GenRecovery --> PushFail["Broadcast Emergency Alert Card into Active Chat<br/>With Instant 'Generate Recovery Link' CTA"]

    EventType -- "dispute.created" --> DispFlow["⚠️ Chargeback Dispute Filed"]
    DispFlow --> TriageDisp["AI Triage: Determine Evidence Deadline<br/>& List Required Proof Documents"]
    TriageDisp --> PushDisp["Broadcast Urgent Dispute Card to Merchant"]
```

---

### 4. Payment Recovery & Dynamic UPI QR Code Generation

```mermaid
flowchart LR
    A["Merchant / User clicks<br/>'Send Recovery Link'<br/>or asks in Chat"] --> B["LLM invokes MCP Tool<br/>create_payment_link"]
    
    B --> C["Fetch Order Details<br/>to ensure exact amount_due"]
    
    C --> D["POST /v1/payment_links<br/>• Amount in Paise<br/>• Customer Name & Contact<br/>• Auto-notification Flags"]
    
    D --> E["Razorpay returns:<br/>• Payment Link ID<br/>• Hosted URL (rzp.io/l/...)"]
    
    E --> F["Dynamic UPI QR Generator<br/>Constructs scannable QR payload"]
    
    F --> G["Render Interactive Card in Chat:<br/>1. 📱 Scannable UPI QR (GPay, PhonePe, Paytm)<br/>2. 💳 One-Click 'Pay on This Device' Button<br/>3. 🔗 Shareable Payment Link"]
    
    G --> H{"Customer Pays via<br/>UPI or Card?"}
    H -->|Payment Captured| I["⚡ Live Webhook Received<br/>Chat updates to PAID instantly"]
```

---

### 5. Multimodal Invoice & Evidence Ingestion Engine

```mermaid
flowchart TD
    Upload["📁 User uploads File into Chat<br/>(.json, .txt, .pdf, .csv, .log, image)"] --> Parse{"File Type Detection"}
    
    Parse -- "JSON / TXT / CSV / Log" --> TextRead["Extract Full Text Payload<br/>(Up to 25,000 characters)"]
    Parse -- "Image / Screenshot" --> ImgRead["Generate Object URL Preview<br/>+ Extract Visual Metadata"]
    Parse -- "PDF Document" --> DocRead["Parse Document Content & Attach Context"]

    TextRead --> StructMatch{"Contains Invoice Data?"}
    ImgRead --> StructMatch
    DocRead --> StructMatch

    StructMatch -- "Yes (e.g. INV-2026-09-002)" --> ExtractData["Identify Key Fields:<br/>• Order ID (order_...)<br/>• Amount (₹1,499.00)<br/>• GSTIN & Line Items<br/>• Customer Email & Phone"]

    ExtractData --> MCPVerify["Automatic MCP Verification:<br/>Execute get_order(order_id)"]
    
    MCPVerify --> CrossCheck{"Compare Extracted Data vs.<br/>Live Razorpay Records"}
    
    CrossCheck -- "Discrepancy Found" --> WarnUser["⚠️ Alert: Invoice amount does not match<br/>live order due amount!"]
    CrossCheck -- "Exact Match" --> Confirm["✅ Verified: Order exists in Razorpay<br/>Display Breakdown & Payment State"]
    
    Confirm --> RenderCard["Interactive Chat Card:<br/>• Tax Invoice Details<br/>• Payment Status<br/>• One-Click Action Trigger"]
```

---

### 6. Dual-Transport MCP Server Architecture

```mermaid
flowchart TD
    subgraph CoreEngine["Razorpay Model Context Protocol Core"]
        Tools["MCP Tools Implementation<br/>• list_payments • get_payment<br/>• list_orders • get_order<br/>• create_order • create_payment_link<br/>• list_refunds • get_refund<br/>• create_refund • list_settlements"]
    end

    subgraph Transport1["Transport 1: Local Stdio (CLI / IDEs)"]
        Stdio["StdioServerTransport<br/>(mcp-server/index.mjs)"]
        StdioClients["Compatible Clients:<br/>• Claude Desktop<br/>• Cursor AI<br/>• Antigravity IDE<br/>• Any MCP Stdio Client"]
    end

    subgraph Transport2["Transport 2: In-Browser Web SDK (Vite SPA)"]
        WebClient["Client MCP Service<br/>(src/services/mcpClient.ts)"]
        ViteProxy["Vite HTTP Proxy<br/>/api/razorpay ➔ api.razorpay.com"]
        BrowserUI["Web Application UI<br/>(Interactive Dashboard)"]
    end

    subgraph RazorpayCloud["Razorpay API v1"]
        APIGateway["https://api.razorpay.com/v1"]
    end

    StdioClients <== "JSON-RPC 2.0 via Stdin/Stdout" ==> Stdio
    Stdio <==> Tools
    Tools <== "Direct HTTPS (Basic Auth)" ==> APIGateway

    BrowserUI <==> WebClient
    WebClient <== "Basic Auth / Fetch" ==> ViteProxy
    ViteProxy <== "Reverse Proxied HTTPS" ==> APIGateway
```

---

## 🚀 Key Features

### 1. Autonomous AI Engine (Google Gemini 2.5 Flash)
- **Google Gemini 2.5 Flash:** High-precision multimodal model capable of analyzing structured JSON, invoice images, and payment logs with zero latency.
- **Native MCP Tool Declarations:** Direct function calling integration with Razorpay REST endpoints.
- **Autonomous Reasoning & Triage:** Analyzes webhook failures, auto-generates recovery payment links and dynamic UPI QR codes.

### 2. Live Model Context Protocol (MCP) Protocol
- **Official Specification Compliant:** Implements `@modelcontextprotocol/sdk` v1.30.
- **Stdio Server & In-Browser Client:** Offers dual execution paths for both standalone desktop AI agents and the web dashboard.
- **100% Real Gateway Communication:** No simulated or mock payment records; queries live Razorpay Test or Production keys directly.

### 3. Real-Time Webhook Automation & Instant Triage
- **Built-in HTTP Webhook Ingestion:** Vite middleware listens on `/api/webhooks/razorpay` to capture incoming events.
- **HMAC-SHA256 Cryptographic Verification:** Validates `x-razorpay-signature` against your webhook secret to prevent tampering.
- **Instant Chat Push Notification:** Real-time poller streams payment confirmations, failure alerts, and dispute warnings into the active chat session.
- **AI-Powered Triage Engine:** Automatically analyzes failure reasons (`BAD_REQUEST_ERROR`, OTP timeouts, insufficient funds) and prepares customer-ready recovery messages.
- **Live Simulator:** Built-in dashboard suite to simulate `payment.failed`, `order.paid`, `dispute.created`, and `refund.processed` events with one click.

### 4. In-Chat Razorpay Checkout & Dynamic UPI QRs
- **Zero-Redirect Modal:** Standard Razorpay Checkout.js opens natively directly on top of the dashboard.
- **Dynamic Scannable UPI QR:** Automatically embeds scannable UPI QR codes in AI responses using standard QR APIs — compatible with Google Pay, PhonePe, Paytm, and BHIM.
- **Interactive Markdown Renderer:** Renders custom payment action buttons inside AI responses that invoke native payment dialogs.

### 5. Multimodal Evidence & Document Analysis
- **Drag-and-Drop Ingestion:** Accepts invoices, receipts, error logs, and transaction screenshots (`.json`, `.txt`, `.pdf`, `.png`, `.jpg`, `.csv`).
- **Context Injection:** Extracts up to 25,000 characters of invoice data and injects it into the LLM conversation stream.
- **Automatic Reconciliation:** Matches invoice order IDs and customer amounts against live Razorpay records to detect unpaid balances or overcharges.

### 6. Live MCP Data Explorer
- **Visual Gateway Inspector:** View live payments, orders, and refunds in real time.
- **Interactive Quick-Actions:** One-click copy for Payment and Order IDs, or quick-query ("Ask AI about this payment").
- **Key Manager Modal:** Safely configure or clear Razorpay Key ID and Secret with instant validation.

### 7. Firebase Cloud Persistence
- **Firebase Authentication:** Secure authentication via Google Sign-In or Email/Password.
- **Real-Time Cloud Firestore:** All chat sessions, message histories, uploaded evidence, and notes are synced across devices in real time.
- **Seamless LocalStorage Migration:** Automatically migrates legacy browser sessions into Firestore upon authentication.

---

## 🛠️ MCP Tool Catalog

The Razorpay MCP implementation exposes the following production tools:

| Tool Name | Scope | Description | Key Parameters |
|---|---|---|---|
| `list_payments` | Payments | Fetch recent payment transactions directly from Razorpay. | `status` (all, captured, failed, refunded), `limit` |
| `get_payment` | Payments | Retrieve complete details for a specific payment ID. | `payment_id` (`pay_...`) |
| `list_orders` | Orders | List merchant orders including amounts paid, due, and receipt numbers. | `limit` |
| `get_order` | Orders | Fetch complete status and payment attempts for a specific order. | `order_id` (`order_...`) |
| `create_order` | Orders | Create a new live unpaid order on Razorpay. | `amount` (in INR), `receipt`, `description` |
| `create_payment_link` | Links / UPI | Generate a payment link and dynamic scannable UPI QR code. | `order_id`, `amount`, `description`, `customer_name` |
| `list_refunds` | Refunds | List refunds with payment references and processing speed. | `payment_id`, `limit` |
| `get_refund` | Refunds | Fetch details of a specific refund ID. | `refund_id` (`rfnd_...`) |
| `create_refund` | Refunds | Issue a full or partial refund for a captured payment. | `payment_id`, `amount` (paise), `reason` |
| `list_settlements` | Settlements | Retrieve merchant bank payout settlements and UTR numbers. | `limit` |
| `get_disputes` | Disputes | Check for open customer chargebacks or disputes. | None |

---

## 📁 Project Directory Structure

```
razorpay-agent/
├── .agents/
│   ├── mcp_config.json                 # Antigravity IDE MCP Server Configuration
│   └── plugins/razorpay/
│       ├── mcp_config.json             # Namespaced plugin configuration
│       └── plugin.json                 # Razorpay plugin manifest
├── mcp-server/
│   └── index.mjs                       # Standalone Node.js MCP Server (Stdio Transport)
├── public/
│   ├── razorpay.svg                    # Razorpay brand assets
│   └── Untitled design (14).svg
├── scripts/
│   └── create_test_orders.mjs          # CLI script to generate live unpaid test orders
├── src/
│   ├── components/
│   │   ├── ui/                         # Shadcn UI component library (Buttons, Dialogs, etc.)
│   │   ├── MarkdownRenderer.tsx        # Markdown renderer with live UPI QR & Payment buttons
│   │   ├── theme-provider.tsx          # Dark / Light theme provider
│   │   ├── WebhookAutomationModal.tsx  # Webhook automation drawer modal
│   │   └── WebhookAutomationPage.tsx   # Dedicated full-page Webhook Ingestion & Triage Suite
│   ├── lib/
│   │   └── firebase.ts                 # Firebase app, auth, and firestore initialization
│   ├── pages/
│   │   ├── Auth.tsx                    # Animated split-screen sign-in / sign-up (GSAP)
│   │   ├── Dashboard.tsx               # Main application dashboard, chat, and MCP explorer
│   │   └── Landing.tsx                 # Clean product landing page with quick-start action
│   ├── services/
│   │   ├── gemini.ts                   # Google Gemini Flash client with function declarations
│   │   ├── firebaseChat.ts             # Firestore session sync & migration utilities
│   │   ├── mcpClient.ts                # In-browser MCP client calling Razorpay REST API
│   │   ├── razorpayCheckout.ts         # Razorpay Checkout.js wrapper with webhook triggers
│   │   └── webhookAutomation.ts        # Webhook ingestion, signature verification & AI triage
│   ├── App.tsx                         # Client-side routing configuration
│   ├── index.css                       # Tailwind CSS v4 design tokens & base typography
│   └── main.tsx                        # Application mount entrypoint
├── .env.example                        # Template for environment credentials
├── index.html                          # HTML template containing Razorpay checkout script
├── mcp_config.json                     # Root MCP configuration for desktop clients
├── package.json                        # NPM scripts and project dependencies
├── tsconfig.json                       # TypeScript compiler configuration
└── vite.config.ts                      # Vite configuration with webhook receiver & reverse proxies
```

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**
- A **Razorpay Account** (Test Mode credentials work out of the box)
- *(Optional)* **Google Gemini API Key** for LLM orchestration

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PandeyAnukrati/razorpay-mcp-agent.git
   cd razorpay-mcp-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Populate the required credentials:

```env
# Razorpay Credentials (from https://dashboard.razorpay.com/app/keys)
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET

# Vite Client Credentials
VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
VITE_RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET

# Webhook Secret (Matches the secret configured in Razorpay Webhooks dashboard)
VITE_RAZORPAY_WEBHOOK_SECRET=rzp_whsec_auto_998877

# AI Orchestration Keys
VITE_GEMINI_API_KEY=AIzaSyYOUR_KEY
```

> **Note:** You can also dynamically configure or override your Razorpay keys directly from the web interface using the **MCP API Keys** button in the dashboard top bar.

### Running the Application

Start the local development server:

```bash
npm run dev
```

The application will start on `http://localhost:5173`. Open this URL in your browser to access the dashboard.

---

## 💻 Running the MCP Server (Stdio Mode)

The project includes an official standalone Model Context Protocol server that communicates via **Standard I/O (`stdio`)**. You can connect it to external desktop AI agents like **Claude Desktop**, **Cursor**, or **Antigravity IDE**.

### Test the MCP Server directly:
```bash
npm run mcp:server
```

### Claude Desktop Configuration
Add the following to your `claude_desktop_config.json` (located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "razorpay": {
      "command": "node",
      "args": ["c:/Users/Shreyansh/Desktop/razorpay-agent/mcp-server/index.mjs"],
      "env": {
        "RAZORPAY_KEY_ID": "rzp_test_YOUR_KEY_ID",
        "RAZORPAY_KEY_SECRET": "YOUR_KEY_SECRET"
      }
    }
  }
}
```

### Cursor / Antigravity IDE Configuration
The repository includes an active `.agents/mcp_config.json` configured as follows:

```json
{
  "mcpServers": {
    "razorpay": {
      "command": "node",
      "args": ["./mcp-server/index.mjs"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

Once loaded, your AI assistant can directly call `list_payments`, `get_payment`, `create_order`, and `create_payment_link` autonomously.

---

## 🧪 Testing & Automation Scripts

### 1. Generating Live Unpaid Test Orders
To test payment link creation, UPI QR generation, and invoice reconciliation with real data, run the bundled test order creation script:

```bash
node scripts/create_test_orders.mjs
```

This will create 3 live test orders directly in your Razorpay account with distinct customer names and amounts (₹1,299.00, ₹2,499.00, ₹4,999.00).

### 2. Testing Webhook Automations
1. Open the dashboard and navigate to the **Webhook Engine** tab.
2. Click **Simulate Failed Payment** to trigger an instantaneous failure payload.
3. Observe the AI triage engine analyze the error code and push a payment recovery notification into your active chat session.
4. Click **Simulate Order Paid** to verify signature validation and watch the instant order confirmation card appear in chat.

---

## 🔒 Security & Compliance

- **HMAC SHA-256 Webhook Verification:** Prevents unauthorized replay attacks by verifying `x-razorpay-signature` against your shared secret.
- **Client-Side Secret Shielding:** Vite proxy routes sensitive API calls (`/api/razorpay`) to preserve key safety without exposing credentials in client-side code.
- **Zero Mock Fallback Mode:** Prevents misleading operations by enforcing hard validation on Razorpay API keys before processing financial operations.
- **Sandboxed Execution:** Supports Razorpay Test Mode keys (`rzp_test_...`) for risk-free simulation before live deployment.

---

## 👩‍💻 Author & Credits

- **Author & Developer:** [Anukrati Pandey](https://github.com/PandeyAnukrati)
- **Repository:** [PandeyAnukrati/razorpay-mcp-agent](https://github.com/PandeyAnukrati/razorpay-mcp-agent)
- **Built With:** [Razorpay API](https://razorpay.com/docs/api/), [Model Context Protocol](https://modelcontextprotocol.io/), [Google Gemini](https://deepmind.google/technologies/gemini/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)

---

<div align="center">

Made with ❤️ for merchants, support engineers, and AI developers.

⭐ **Star this repository if you find it helpful!**

</div>