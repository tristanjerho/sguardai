# SmileGuard AI 🦷✨

> Intelligent Dental Clinic Management and Orthodontic Monitoring Platform.

## 🚀 Overview
**SmileGuard AI** is a dental practice and orthodontic monitoring platform featuring role-based portals for **Patients**, **Dental Practitioners**, and **Clinic Administrators**.

### Features
- **Patient Portal**:
  - Interactive **Sparky the Smile Guard** animated companion mascot
  - 3-Step Appointment Booking Wizard with conflict/double-booking blocker
  - Orthodontic alignment progress timeline and stage percentages
  - Radiology and diagnostic OPG / cephalometric records gallery with image lightbox
  - Gamified morning & night brush streak tracker with unlockable achievement badges
  - Dental IQ trivia mini-quiz game
  - Medical onboarding with Republic Act No. 10173 (Data Privacy Act of 2012) compliance
- **Clinic Portal (Dentists & Specialists)**:
  - Real-time appointment triage queue (approve / decline with clinical reason / mark completed)
  - Weekly volume analytics powered by Recharts
  - Comprehensive Patient Directory & full digital case files
  - Orthodontic stage manager and clinical notes tracker
  - Dental Laboratory appliance order tracking (retainers, expanders, crowns)
  - **AI Diagnostic Workstation** with Grad-CAM activation heatmap overlay & confidence bars
- **SmileGuard Assistant (Narrow Conversational AI)**:
  - Role-aware clinical dental decision support assistant (Dentist, Receptionist, Administrator, Patient)
  - Dental radiograph AI diagnostic guidance (Stage 1 MobileNetV2 OPG Validator + Stage 2 EfficientNetB0 Pathology Classifier)
  - Explanations for Dental Caries, Impacted Teeth, Periapical Lesions / Infection, and Periodontal Bone Loss
  - 32-Tooth adult odontogram surface charting guidance and CAD/CAM dental lab tracking
  - Strict domain guardrails with polite out-of-scope redirection
  - Clinical decision support disclaimer: *"AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."*
  - Floating responsive dental-themed chat widget with Framer Motion animations
  - Dual backend deployment: Vercel Serverless Functions (`api/chat.js`) and FastAPI (`backend/main.py`)
  - Configurable model (Google Gemini 1.5 Flash via `GEMINI_API_KEY` with automatic clinical fallback engine)
- **Admin Portal**:
  - Staff account provisioning (Dentist / Admin)
  - Role management & account activation toggles
  - Auditable immutable activity & security logs


---

## 💻 Tech Stack
- **React 18** + **Vite**
- **TailwindCSS** (Custom tokens with Light and Dark theme modes)
- **Framer Motion** (Accessible animations respecting `prefers-reduced-motion`)
- **Lucide React** (Icons)
- **Recharts** (Clinical charts)
- **Canvas Confetti** (Milestone celebrations)
- **Firebase Authentication** (Email/Password & Google Sign-In)
- **Cloud Firestore** (Server-authoritative role-based access & real-time sync)
- **Cloudinary** (Direct unsigned clinical radiograph & photo uploads)
- **Vite PWA** (`vite-plugin-pwa` with zero clinical caching)
- **TailwindCSS** (Custom clinical tokens with Light and Dark theme modes)
- **Framer Motion** (Accessible animations respecting `prefers-reduced-motion`)
- **Lucide React** (Icons)
- **Recharts** (Clinical charts & volume tracking)
- **Canvas Confetti** (Milestone celebrations)

---

## 🛠️ Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production with PWA service worker
npm run build
```

---

## 📋 Next Steps & Deployment

Refer to the [Next Steps Action Plan & Operator Guide](file:///c:/Users/My%20Computer/Desktop/sguardai/NEXT_STEPS_ACTION_PLAN.md) for step-by-step instructions on:
1. Deploying Firestore security rules and composite indexes to `sguardai-7d893`
2. Setting up Cloudinary upload presets
3. Bootstrapping the first Superadmin account and provisioning clinical staff
4. Testing PWA standalone installation on Android and iOS devices
5. Configuring the trusted AI backend service boundary

---

## ☁️ Deployment Instructions for Vercel

SmileGuard AI is pre-configured for one-click deployment on **Vercel** with full support for frontend single-page application routing and serverless backend API endpoints (`/api/chat`).

### 1. Connect Repository to Vercel
1. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
2. Import your SmileGuard AI repository.
3. Vercel automatically detects the framework preset as **Vite**.

### 2. Configure Environment Variables
In the Vercel project settings under **Settings > Environment Variables**, add:

| Variable Name | Value Description | Scope |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | Client-Safe |
| `VITE_FIREBASE_AUTH_DOMAIN` | `sguardai-7d893.firebaseapp.com` | Client-Safe |
| `VITE_FIREBASE_PROJECT_ID` | `sguardai-7d893` | Client-Safe |
| `VITE_FIREBASE_STORAGE_BUCKET` | `sguardai-7d893.firebasestorage.app` | Client-Safe |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `551256402483` | Client-Safe |
| `VITE_FIREBASE_APP_ID` | `1:551256402483:web:...` | Client-Safe |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-SXQPXL9KR0` | Client-Safe |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name (`irmjysgg`) | Client-Safe |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Unsigned Preset (`smileguard_uploads`) | Client-Safe |
| `VITE_AI_SERVICE_URL` | `https://sguardai.onrender.com/api/predict` | Client-Safe |
| `VITE_AI_MODEL_INFO_URL` | `https://sguardai.onrender.com/api/model-info` | Client-Safe |
| `GEMINI_API_KEY` | Google Gemini API Key | **Server-Side Only (Never prefix with VITE_)** |
| `AI_CHAT_MODEL` | `gemini-1.5-flash` | **Server-Side Only** |

> 🔒 **Security Notice**: `GEMINI_API_KEY` is kept strictly on the server side in `api/chat.js` and is never exposed to the client bundle.

### 3. Build & Output Settings
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

The included `vercel.json` automatically maps `/api/(.*)` to Vercel Serverless Functions and rewrites single-page application routes to `/index.html`.

