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
