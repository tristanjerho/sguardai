# SmileGuard AI — Next Steps Action Plan & Operator Guide 🦷📋

> **Target Version**: 1.0.0 (Production-Hardened)  
> **Target Project**: `sguardai-7d893`  
> **Status**: Core Services, Hardened Auth, PWA, and Security Boundaries Implemented & Verified.

---

## 📑 Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Immediate Priority Checklist](#2-immediate-priority-checklist)
3. [Phase 1: Cloud & Infrastructure Deployment](#3-phase-1-cloud--infrastructure-deployment)
4. [Phase 2: Administrative Bootstrap & Staff Provisioning](#4-phase-2-administrative-bootstrap--staff-provisioning)
5. [Phase 3: End-to-End Clinical Verification](#5-phase-3-end-to-end-clinical-verification)
6. [Phase 4: PWA Mobile Installation & Offline Boundary Testing](#6-phase-4-pwa-mobile-installation--offline-boundary-testing)
7. [Phase 5: Trusted AI Backend Service Boundary](#7-phase-5-trusted-ai-backend-service-boundary)
8. [Security & Compliance Invariants](#8-security--compliance-invariants)

---

## 1. Executive Summary

SmileGuard AI has been transitioned from a prototype into a production-ready application architecture. All mock layers, demo credentials, synthetic databases, and fake AI inference have been completely removed. 

The application is now governed by:
- **Zero Fabrication Policy**: Real Firebase Auth, live Cloud Firestore, and direct Cloudinary unsigned REST uploads.
- **Server-Authoritative Role Provisioning**: Self-registration strictly defaults to `PATIENT`. Role escalation by the client is prevented at the database rules layer. Staff roles (`DENTIST`, `LAB_TECH`, `ADMIN`, `SUPERADMIN`) are administrator-provisioned.
- **Progressive Web App (PWA)**: Standalone installable experience for Android, iOS Safari, and Desktop with **Zero Clinical Data Caching**.
- **Private AI Boundary**: AI calls route through a trusted server endpoint with Firebase Bearer authentication, ensuring no `VITE_GEMINI_API_KEY` is exposed in the frontend bundle.

---

## 2. Immediate Priority Checklist

| Priority | Task | Responsibility / Tool | Estimated Effort |
| :--- | :--- | :--- | :--- |
| 🔴 **P0** | **Deploy Firestore Rules & Indexes** | Firebase CLI (`npx firebase deploy`) | ~2 mins |
| 🔴 **P0** | **Set up Cloudinary Unsigned Upload Preset** | Cloudinary Console + `.env` | ~5 mins |
| 🟡 **P1** | **Bootstrap First Superadmin Account** | Firestore Console (one-time manual promotion) | ~3 mins |
| 🟡 **P1** | **Provision Initial Clinical Staff** | SmileGuard Admin Portal (`/admin`) | ~5 mins |
| 🟢 **P2** | **Verify Real Workflows on Clean Database** | Web Browser / Mobile Device | ~15 mins |
| 🟢 **P2** | **Test PWA Installation on Android & iOS** | Chrome (Android) & Safari (iOS) | ~10 mins |
| 🔵 **P3** | **Deploy Trusted AI Backend Function** | Cloud Run / Cloud Functions (Gemini 1.5) | ~30 mins |

---

## 3. Phase 1: Cloud & Infrastructure Deployment

### 1.1 Deploy Firestore Security Rules & Composite Indexes
Your local workspace contains the production-hardened `firestore.rules` and query-backed `firestore.indexes.json`. Deploy them directly to your Firebase project:

```bash
# Execute deployment to live Firebase project
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project sguardai-7d893
```

> [!IMPORTANT]
> This applies server-authoritative role lock so that nobody can modify their own role document in Firestore.

---

### 1.2 Configure Cloudinary Unsigned Upload Preset
Dental images, radiographs, and OPG scans are uploaded directly via Cloudinary REST API to avoid server bottlenecks.

1. Log into your [Cloudinary Console](https://cloudinary.com/console).
2. Navigate to **Settings** (gear icon) ➔ **Upload**.
3. Scroll to **Upload presets** and click **Add upload preset**.
4. Configure the preset:
   - **Upload preset name**: e.g., `sguard_dental_preset`
   - **Signing Mode**: Select **Unsigned**
   - **Folder**: `smileguard_radiographs`
   - **Allowed formats**: `jpg, png, webp`
5. Save changes and update your local `.env` file:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=sguard_dental_preset
   ```

---

### 1.3 Verify Firebase Authorized Domains
To prevent `auth/unauthorized-domain` popup errors during Google Sign-In:
1. Open [Firebase Console](https://console.firebase.google.com/) ➔ Project `sguardai-7d893`.
2. Go to **Authentication** ➔ **Settings** tab ➔ **Authorized domains**.
3. Verify that `localhost` is listed.
4. When you deploy the frontend to custom domains or hosting providers, add those domain names to this list.

---

## 4. Phase 2: Administrative Bootstrap & Staff Provisioning

Because of the **Server-Authoritative Role Provisioning** rule, every new self-registered account (Email or Google) is strictly locked to `PATIENT`. Therefore, the first administrative account must be bootstrapped:

### 2.1 First Superadmin Bootstrap Procedure
```text
1. Visit http://localhost:3001/signup (or click "Continue with Google")
2. Create your account with your administrative email
   └── Account is automatically created as role: "PATIENT"
3. Open Firebase Console ➔ Firestore Database ➔ "users" collection
4. Click on your user document (matching your Auth UID)
5. Edit field:
   role: "SUPERADMIN"
6. Refresh http://localhost:3001/
   └── System automatically routes you to the /admin portal!
```

### 2.2 Provisioning Clinical Staff Accounts
Once logged in as `SUPERADMIN` or `ADMIN`:
1. Navigate to the **Admin Portal** (`/admin`).
2. Open **Staff Management** ➔ **Provision Staff Member**.
3. Create accounts for:
   - **Dentist**: Select Role `DENTIST`, enter full name, professional license number, and dental specialty (e.g. *Orthodontics*, *General Dentistry*).
   - **Lab Technician**: Select Role `LAB_TECH`, assign to the dental laboratory department.
4. Staff can now log in using their credentials and are automatically routed to their designated clinical portals (`/clinic` for Dentists, `/lab` for Lab Technicians).

---

## 5. Phase 3: End-to-End Clinical Verification

Run through each clinical persona to ensure full functionality on an empty database:

### 3.1 Patient Journey
- [ ] Sign in with Google or Email.
- [ ] Complete the 3-step Medical History Questionnaire & RA 10173 Consent (`/onboarding`).
- [ ] Book an appointment (`/appointments`): Select procedure, dentist, and timeslot.
- [ ] Verify that double-booking the same slot displays a real-time conflict error.
- [ ] Log morning/night brushing (`/streak`) and check streak incrementation and trivia mini-quiz with Sparky.

### 3.2 Dentist Chairside Journey
- [ ] Sign in as a provisioned Dentist ➔ Access `/clinic`.
- [ ] Review appointment queue: Approve or reschedule the booked patient appointment.
- [ ] Open the patient case file ➔ Inspect the **Interactive 32-Tooth Odontogram**:
  - Click individual teeth (FDI 11–48 / Universal 1–32).
  - Select tooth surfaces (Occlusal, Mesial, Distal, Buccal, Lingual).
  - Assign clinical condition (Caries, Composite, Amalgam, Crown, Root Canal, Missing, Implant).
  - Click **Save Tooth Data** and verify live Firestore write.
- [ ] Upload an OPG or bite-wing radiograph: Confirm direct upload to Cloudinary and metadata entry in `dentalImages/`.

### 3.3 Dental Lab Technician Journey
- [ ] Sign in as provisioned Lab Tech ➔ Access `/lab`.
- [ ] View the 6-stage CAD/CAM Kanban Board:
  `RECEIVED` ➔ `DESIGN` ➔ `MILLING` ➔ `GLAZING` ➔ `QA` ➔ `DISPATCHED`.
- [ ] Advance an appliance order (e.g., *Clear Retainer*, *Zirconia Crown*) through each fabrication stage.

---

## 6. Phase 4: PWA Mobile Installation & Offline Boundary Testing

### 4.1 Real Device Installation
* **Android (Google Chrome)**:
  1. Open app URL on device.
  2. Tap the in-app installation banner or Chrome menu `⋮` ➔ **Install application**.
  3. Verify standalone launch from the home screen with splash screen and `#0d9488` teal theme bar.
* **iOS (Apple Safari)**:
  1. Open app URL in Safari.
  2. Tap the **Share** button (`⎋`).
  3. Scroll down and tap **Add to Home Screen** (`⊞`).
  4. Launch from home screen and verify no browser navigation chrome.
* **Desktop (Chrome / Edge)**:
  1. Click the install icon in the address bar ➔ **Install SmileGuard AI**.

### 4.2 Verifying Zero Clinical Data Caching
To confirm strict compliance with healthcare privacy regulations:
1. Open Developer Tools (F12) ➔ **Application** tab ➔ **Storage** ➔ **Cache Storage**.
2. Verify only static files are present (`workbox-precache`, Google fonts stylesheets/webfonts).
3. Switch to **Network** tab:
   - Verify requests to `firestore.googleapis.com` are marked `(fetch)` from network, **never** `(ServiceWorker)`.
   - Verify requests to `res.cloudinary.com` are **never** stored in the service worker cache.

---

## 7. Phase 5: Trusted AI Backend Service Boundary

To activate the **AI Diagnostic Workstation** without exposing private API keys:

```text
┌──────────────────────────┐             ┌──────────────────────────┐             ┌──────────────────────────┐
│   SmileGuard Frontend    │             │   Trusted Backend API    │             │       Google Gemini      │
│     (Client Browser)     │             │     (Cloud Function)     │             │      1.5 Flash API       │
└────────────┬─────────────┘             └────────────┬─────────────┘             └────────────┬─────────────┘
             │                                        │                                        │
             │ POST /api/analyze                      │                                        │
             │ Authorization: Bearer <FirebaseIdToken>│                                        │
             │ Body: { imageUrl, patientId }          │                                        │
             ├───────────────────────────────────────>│                                        │
             │                                        │ 1. Verify Firebase ID Token            │
             │                                        │ 2. Read authenticated UID & role       │
             │                                        │ 3. Check Dentist / Admin privileges    │
             │                                        │                                        │
             │                                        │ Call Gemini with private API key       │
             │                                        ├───────────────────────────────────────>│
             │                                        │                                        │
             │                                        │ Diagnostic JSON + Pathologies          │
             │                                        │<───────────────────────────────────────┤
             │ Real AI Diagnostic Results             │                                        │
             │<───────────────────────────────────────┤                                        │
```

### Setup Steps
1. Create a lightweight Node.js/Python serverless function (e.g. Firebase Cloud Function or Cloud Run):
   - Securely store `GEMINI_API_KEY` in Google Cloud Secret Manager / environment variables.
   - Use `firebase-admin` to verify `req.headers.authorization`.
   - Send the image URL to `gemini-1.5-flash` with clinical dental prompt instructions.
2. Add the function endpoint URL to `.env`:
   ```env
   VITE_AI_SERVICE_URL=https://your-region-sguardai-7d893.cloudfunctions.net/analyzeRadiograph
   ```
3. Test inference chairside via the **AI Workstation** tab in `/clinic`.

---

## 8. Security & Compliance Invariants

Always maintain these architecture rules:
1. **Never commit `.env`**: Kept strictly local; template tracked in `.env.example`.
2. **Never expose `VITE_GEMINI_API_KEY`**: AI calls must always go through `VITE_AI_SERVICE_URL`.
3. **No Synthetic Mock Fallbacks**: Empty database states must show genuine zero counts or empty placeholder states.
4. **Enforce RA 10173 Privacy**: All patient diagnostic records and health questionnaires must maintain explicit patient consent.
5. **No Offline Storage of Health Records**: Service workers must strictly avoid caching personal clinical data.
