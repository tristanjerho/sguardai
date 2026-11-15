"""
SmileGuard AI - Narrow Conversational Dental Assistant Engine
Handles role-based system prompts, clinical dental decision support guardrails,
strict out-of-scope redirection, rate limiting, and provider integration
(Google Gemini 1.5 Flash / OpenAI / Smart Dental Rule Engine).
"""

import os
import re
import time
from typing import Dict, Any, List, Optional

# System Prompt mandated by SmileGuard AI specifications
SMILEGUARD_SYSTEM_PROMPT = """You are Gardy Assistant, an AI-powered support assistant integrated into SmileGuard AI, an AI-assisted dental clinic management and clinical decision support system.

Your purpose is to help authorized users understand and use SmileGuard AI and provide general dental information relevant to dental clinic workflows.

You must follow these rules:

1. Stay within the scope of dental clinic management, dental education, SmileGuard AI functionality, and dental workflow assistance.
2. Keep answers concise, clear, professional, and easy to understand.
3. Adapt your explanations based on the authenticated user's role.
4. Never pretend to have accessed patient records, appointments, diagnostic results, or laboratory messages unless the backend explicitly provides that information.
5. Never fabricate patient information, AI predictions, appointments, or system functionality.
6. Never treat AI-generated dental X-ray predictions as confirmed diagnoses.
7. Encourage qualified dental professionals to validate all clinical findings.
8. Protect patient confidentiality and personal information.
9. Do not provide unrelated general-purpose assistance.
10. When asked an unrelated question, politely redirect the user to SmileGuard AI and dental clinic-related topics.
11. When unsure about a system feature, acknowledge the limitation instead of inventing instructions.
12. Do not replace professional dental judgment or emergency medical care.

Your communication style should be friendly, professional, concise, and supportive.

CRITICAL CLINICAL DISCLAIMER:
Whenever discussing dental diagnostic findings, X-rays, or conditions, always include or reinforce:
"AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."
"""

ROLE_CONTEXT_INSTRUCTIONS = {
    "DENTIST": (
        "USER ROLE: DENTIST / SPECIALIST.\n"
        "Prioritize:\n"
        "- Dental X-ray AI interpretation guidance and understanding the 2-stage CNN pipeline.\n"
        "- Explaining predicted dental conditions (Dental Caries, Impacted Teeth, Infection, Periodontal Bone Loss, BDC-BDR).\n"
        "- Patient case records and the 32-tooth interactive adult odontogram (surfaces: Mesial, Distal, Occlusal, Buccal, Lingual).\n"
        "- Chairside appointments queue triage (/clinic/queue: PENDING -> CONFIRMED -> IN_CHAIR -> COMPLETED/CANCELLED/REJECTED).\n"
        "- Clinical workflow guidance and treatment plans.\n"
        "- Dental laboratory CAD/CAM requests and appliance fabrication tracking (/clinic/lab-orders: Received -> CAD -> CAM -> Glazing -> QA -> Dispatched).\n"
        "Always reinforce that AI predictions are clinical decision support and require dentist validation."
    ),
    "RECEPTIONIST": (
        "USER ROLE: CLINIC RECEPTIONIST / CLINIC STAFF.\n"
        "Prioritize:\n"
        "- Patient registration and medical onboarding under RA 10173.\n"
        "- Appointment scheduling, queue management, and conflict prevention (/clinic/queue).\n"
        "- Appointment status checks (Pending, Confirmed, In Chair, Completed, Cancelled).\n"
        "- Patient contact details and directory search (/clinic/patients).\n"
        "- Front-desk scheduling and daily clinic queue workflows."
    ),
    "ADMIN": (
        "USER ROLE: CLINIC ADMINISTRATOR / SUPERADMIN.\n"
        "Prioritize:\n"
        "- Staff account provisioning and user role management (/admin/users).\n"
        "- Promoting or activating Dentist, Lab Tech, or Admin accounts.\n"
        "- Clinic operations oversight and practice management settings.\n"
        "- Reviewing immutable security and clinical audit logs (/admin/logs).\n"
        "- System health and integration configuration."
    ),
    "SUPERADMIN": (
        "USER ROLE: SUPERADMINISTRATOR.\n"
        "Prioritize:\n"
        "- Full system administration, role promotions, and staff registry (/admin/users).\n"
        "- Immutable activity and security audit trail inspection (/admin/logs).\n"
        "- SuperAdmin command center metrics and database controls."
    ),
    "LAB_TECH": (
        "USER ROLE: DENTAL LABORATORY TECHNICIAN.\n"
        "Prioritize:\n"
        "- Digital CAD/CAM & service-specific lab intake queue (/lab) and fabrication production board (/lab/board).\n"
        "- Advancing fabrication stages through Quality Check and Dispatch.\n"
        "- Appliance prescriptions (Monolithic Zirconia crowns, e.max veneers, PFM, Hawley & Clear Essix retainers, dentures).\n"
        "- Communicating fabrication progress and clarification requests back to attending dentists."
    ),
    "PATIENT": (
        "USER ROLE: PATIENT.\n"
        "Prioritize:\n"
        "- 3-step dynamic appointment booking wizard (/patient/book: Procedure -> Dentist -> Date & Time Slot).\n"
        "- Viewing, rescheduling, or cancelling upcoming/past/cancelled appointments (/patient/appointments).\n"
        "- Orthodontic alignment progress timeline and tray changeover milestones (/patient/treatment).\n"
        "- Viewing personal dental records and imaging gallery (/patient/records).\n"
        "- Gamified morning and night brushing streak tracker with Gardy mascot (/patient).\n"
        "- Basic dental education, oral hygiene best practices, and explaining common dental procedures in simple language.\n"
        "Strictly remind patients that assistant answers are for educational purposes and cannot replace an in-person dental consultation."
    ),
    "GUEST": (
        "USER ROLE: GUEST / VISITOR.\n"
        "Provide an introduction to SmileGuard AI's intelligent dental clinic platform, features for patients, dentists, and administrators, and guide them to sign in or register."
    )
}

SMILEGUARD_APP_KNOWLEDGE = """
SmileGuard AI Platform Reference:
- AI Diagnostic Workstation (/clinic/ai-workstation): Real Two-Stage CNN pipeline.
  * Stage 1: EfficientNetB0 Binary OPG Validator. Acts as a gatekeeper (0.60 decision threshold) to verify if the radiograph is an authentic Dental OPG. Non-OPG images (photos, documents, selfies) are rejected with status 'invalid_xray' (INVALID_XRAY_IMAGE) to prevent false clinical classifications.
  * Stage 2: EfficientNetB0 Pathology Classifier. Evaluates verified dental OPGs across 6 classes: BDC-BDR, Caries, Fractured Teeth, Healthy Teeth, Impacted teeth, and Infection.
  * Explainability: Pre-softmax Class Activation Mapping (Grad-CAM) targeting layer 'top_activation' (7x7x1280), blended with TURBO/Jet colormap overlay.
  * Policy: Zero fabrication of AI predictions.
- 32-Tooth Interactive Adult Odontogram (/clinic/patients/:id): Full FDI/Universal charting with 5 surfaces per tooth (Mesial, Distal, Occlusal, Buccal, Lingual). Supported statuses: Sound, Caries, Filled, Crown, Bridge, Missing, Endodontic Treated, Extraction Indicated.
- Triage Appointments Queue (/clinic/queue): Real-time queue for chairside status updates: PENDING -> CONFIRMED -> IN_CHAIR -> COMPLETED (or CANCELLED/REJECTED with reason). Enforces conflict-free time slots per dentist (09:00 AM - 05:00 PM).
- Dental Laboratory Intake & Production Board (/clinic/lab-orders, /lab, /lab/board): Service-specific production workflows (Orthodontic Retainers, Crowns & Bridges CAD/CAM & Conventional, Dentures with Clinic Try-In, Repairs, Custom Appliances) with 6-stage CAD/CAM fabrication tracking through Quality Check and Dispatch.
- Patient Portal (/patient):
  * Book Appointment (/patient/book): 3-step booking wizard (Procedure -> Dentist -> Date & Time Slot) for creating a new appointment.
  * My Appointments (/patient/appointments): View already scheduled Upcoming, Past, and Cancelled appointments; reschedule or cancel visits. (Always direct users asking where to see existing/scheduled appointments to /patient/appointments, NOT /patient/book.)
  * Treatment Progress (/patient/treatment): Orthodontic alignment timeline and milestone stages.
  * Dental Records (/patient/records): Radiographs, OPG viewer with zoom/pan/contrast, and clinical history.
  * Daily Brushing Streaks (/patient): Morning/night check-ins and 2-minute timer with Gardy mascot.
- Admin Portal (/admin/users, /admin/logs): Staff account provisioning (DENTIST, RECEPTIONIST, LAB_TECH, ADMIN, SUPERADMIN) and immutable security/activity audit logs.
- Compliance: Republic Act No. 10173 (Philippine Data Privacy Act of 2012) consent for medical onboarding.
"""

# In-memory rate limiting sliding window (IP/UID -> list of timestamps)
RATE_LIMIT_STORE: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 20

def check_rate_limit(client_id: str) -> bool:
    """Returns True if request is allowed, False if rate limit is exceeded."""
    now = time.time()
    timestamps = RATE_LIMIT_STORE.get(client_id, [])
    # Filter out timestamps older than window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        RATE_LIMIT_STORE[client_id] = timestamps
        return False
    timestamps.append(now)
    RATE_LIMIT_STORE[client_id] = timestamps
    return True

# Pattern to detect obvious out-of-scope non-dental queries
OUT_OF_SCOPE_PATTERNS = [
    r"\b(write a poem|write code|python script|solve this math|who won the world cup|recipe for|president of|stock price|weather in|crypto|bitcoin)\b"
]

def is_out_of_scope(message: str) -> bool:
    msg_lower = message.lower().strip()
    for pattern in OUT_OF_SCOPE_PATTERNS:
        if re.search(pattern, msg_lower):
            return True
    return False

def _is_patient_context(role: str, context: Optional[Dict[str, Any]] = None) -> bool:
    normalized_role = (role or "GUEST").upper()
    current_path = (context or {}).get("currentPath") or ""
    is_patient_portal_path = (
        current_path == "/patient"
        or current_path.startswith("/patient/")
        or current_path == "/onboarding"
    )
    return normalized_role == "PATIENT" or (normalized_role == "GUEST" and is_patient_portal_path)


def generate_rule_based_response(
    user_msg: str,
    role: str,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Intelligent built-in SmileGuard dental clinical assistant engine.
    Used when external API keys are not provided or as an immediate, reliable fallback.
    """
    msg = (user_msg or "").lower().strip()
    normalized_role = (role or "GUEST").upper()
    is_patient_user = _is_patient_context(normalized_role, context)

    # Out of scope deflection
    if is_out_of_scope(msg):
        return {
            "content": (
                "I am **Gardy Assistant**, specifically designed for dental clinic operations, "
                "dental education, and SmileGuard AI workflows. I cannot assist with general topics "
                "outside of dental care and clinic management.\n\n"
                "How can I help you with your dental practice, appointment queue, patient records, or AI X-ray diagnostics today?"
            ),
            "followUps": (
                [
                    "Where can I see my scheduled appointments?",
                    "How do I book an appointment?",
                    "How do daily brushing streaks work?"
                ]
                if is_patient_user
                else [
                    "How do I manage patient appointments?",
                    "What does the AI dental X-ray diagnosis mean?",
                    "What features are available in SmileGuard AI?"
                ]
            )
        }

    # Emergency Detection
    is_emergency = bool(re.search(r"\b(severe swelling|facial swelling|swollen face|face swollen|difficulty breathing|trouble breathing|difficulty swallowing|uncontrolled bleeding|heavy bleeding|knocked out tooth|avulsed tooth|severe trauma)\b", msg))
    emergency_prefix = ""
    if is_emergency:
        emergency_prefix = (
            "> 🚨 **URGENT DENTAL TRIAGE ADVISORY**:\n"
            "> The symptoms described may represent an acute dental emergency (e.g. spreading facial space infection, respiratory compromise, or uncontrolled hemorrhage). "
            "Please visit your nearest hospital emergency department or contact emergency dental services immediately.\n\n"
        )
        content = (
            f"{emergency_prefix}### 🚨 Immediate Dental Triage Guidance\n\n"
            "If you or a patient is experiencing severe facial swelling, difficulty breathing or swallowing, "
            "uncontrolled hemorrhage, or a knocked-out permanent tooth, immediate emergency care is essential:\n\n"
            "1. **Airway & Facial Space Infection**: Progressive swelling spreading toward the eye, submandibular space, "
            "or floor of the mouth can compromise the airway (Ludwig's angina). Go to the nearest Emergency Room immediately.\n\n"
            "2. **Knocked-Out (Avulsed) Permanent Tooth**: Keep tooth moist in cold milk or saliva (do NOT scrub the root surface) "
            "and see a dentist within 30–60 minutes for highest replantation success.\n\n"
            "3. **Uncontrolled Bleeding**: Apply firm, continuous pressure with sterile gauze for 20 minutes. If bleeding persists, seek urgent care.\n\n"
            "> ⚠️ *Gardy Assistant is for clinical decision support and educational reference only. It does not replace emergency medical care.*"
        )
        return {
            "content": content,
            "followUps": (
                [
                    "How do I book an appointment?",
                    "Where can I see my scheduled appointments?",
                    "What do I do if I have a toothache?"
                ]
                if is_patient_user
                else [
                    "How do I manage patient appointments?",
                    "What does the AI dental X-ray diagnosis mean?",
                    "Where can I find the clinic directory?"
                ]
            )
        }

    is_greeting_only = bool(re.search(r"^(hello|hi|hey|good\s*(morning|afternoon|evening|day)|kamusta|kumusta|yo|sup|greetings)(\s+(gardy|assistant|there|doc|po))?[!.,?\s]*$", msg))
    is_thanks_only = bool(re.search(r"^(thanks?|thank\s+you|salamat|ty|appreciate(\s+it)?)(\s+(gardy|so\s+much|very\s+much|po))?[!.,?\s]*$", msg))

    # Patient Role / Portal Specific Dental & Workflow Knowledge
    if is_patient_user:
        if is_greeting_only:
            return {
                "content": (
                    "Hello! 😊 I'm **Gardy Assistant**, your interactive SmileGuard AI dental companion.\n\n"
                    "I can help you with anything related to your teeth and dental care:\n"
                    "- 📅 **Appointments**: [Book a Visit](/patient/book) or view [My Scheduled Appointments](/patient/appointments).\n"
                    "- 🪥 **Daily Brushing Streaks**: Track your morning & evening habits with our 2-minute timer.\n"
                    "- 🦷 **Dental Concerns**: Advice on toothaches, sensitivity, bleeding gums, cleanings, and cavities.\n"
                    "- 📈 **Treatment Progress**: Monitor your braces or clear aligners.\n\n"
                    "How can I help you take care of your smile today?"
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "Where can I see my scheduled appointments?",
                    "How do daily brushing streaks work?",
                    "What do I do if I have a toothache?"
                ]
            }

        if is_thanks_only:
            return {
                "content": (
                    "You're very welcome! Keep smiling and taking great care of your teeth. Remember to log your brushing streak with Gardy tonight! 🪥✨\n\n"
                    "Let me know if you have any other dental or appointment questions."
                ),
                "followUps": [
                    "How do daily brushing streaks work?",
                    "Where can I see my scheduled appointments?",
                    "How do I book an appointment?"
                ]
            }

        if (
            re.search(r"\b(see|view|check|where|find|show|list|my|upcoming|past|cancelled|manage|status)\b.*\b(appointments?|visits?|bookings?)\b|\b(my|scheduled|upcoming|past|cancelled)\s+(appointments?|visits?|bookings?)\b|\b(reschedule|cancel)\b.*\b(appointments?|bookings?|visits?)\b", msg)
            and (not re.search(r"\bbook\b", msg) or bool(re.search(r"\b(reschedule|cancel)\b", msg)))
        ):
            return {
                "content": (
                    f"{emergency_prefix}### 📆 Viewing & Managing Your Scheduled Appointments\n\n"
                    "You can view all of your clinic visits anytime in **[My Appointments](/patient/appointments)**:\n\n"
                    "- **Upcoming Tab**: Check your `PENDING` and `CONFIRMED` bookings along with the scheduled date, time slot, and attending dentist.\n"
                    "- **Past Tab**: Review your previously `COMPLETED` dental visits.\n"
                    "- **Cancelled Tab**: See any `CANCELLED` or `REJECTED` appointments (including clinical notes or decline reasons).\n"
                    "- **Reschedule or Cancel**: On any upcoming appointment card, click **Reschedule** to pick a new date and open time slot, or **Cancel** to cancel the booking.\n\n"
                    "👉 [Open My Appointments](/patient/appointments) or [Book a New Visit](/patient/book)"
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "Where can I see my orthodontic treatment progress?",
                    "Where can I see my dental records?"
                ]
            }

        if re.search(r"\b(book|schedule|reserve)\b.*\b(orthodontics?|ortho|braces?|adjustments?|aligners?|retainers?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Booking an Orthodontic Adjustment\n\n"
                    "You can schedule your braces tightening or aligner checkup through our 3-step wizard:\n\n"
                    "1. Open **[Book Appointment](/patient/book)** and select **Ortho Braces** as your procedure.\n"
                    "2. Choose your attending dentist or orthodontist.\n"
                    "3. Pick your preferred date and open time slot (`09:00 AM` – `05:00 PM`).\n\n"
                    "Once submitted, you can track confirmation status in **[My Appointments](/patient/appointments)**.\n\n"
                    "👉 [Book Orthodontic Adjustment](/patient/book)"
                ),
                "followUps": [
                    "Where can I see my scheduled appointments?",
                    "Where can I see my orthodontic treatment progress?",
                    "What should I do if a bracket comes loose?"
                ]
            }

        if re.search(r"\bclean(ing)?\b.*\b(aligners?|retainers?|trays?)\b|\b(aligners?|retainers?|trays?)\b.*\b(clean|care|wash|soak)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### ✨ How to Clean Your Aligners or Retainers\n\n"
                    "Proper daily care prevents plaque buildup, odor, and warping:\n\n"
                    "1. **Rinse With Cool or Lukewarm Water**: Rinse your aligner or retainer every time you remove it. **Never use hot water**, as heat can warp the plastic.\n"
                    "2. **Brush Gently**: Use a separate soft-bristled toothbrush with mild clear liquid soap (avoid abrasive whitening toothpaste, which scratches clear plastic).\n"
                    "3. **Deep Soak**: Soak periodically in a dentist-approved retainer/aligner cleaning solution.\n"
                    "4. **Store Safely**: Always place your appliance in its ventilated protective case when eating or drinking anything other than plain water.\n\n"
                    "👉 Need an appliance check or replacement? [Book an Appointment](/patient/book)"
                ),
                "followUps": [
                    "Where can I see my orthodontic treatment progress?",
                    "What should I do if a bracket comes loose?",
                    "How do I book an orthodontic adjustment?"
                ]
            }

        if re.search(r"\b(brackets?|wires?|bands?)\b.*\b(loose|broken|pok(e|ing)|came\s*off|fell\s*off|detached|problem)\b|\bloose\s+brackets?\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🛠️ What to Do If a Bracket Comes Loose\n\n"
                    "Don't panic—follow these steps to stay comfortable until your dentist fixes it:\n\n"
                    "1. **Apply Orthodontic Wax**: Roll a small piece of orthodontic wax between clean fingers and press it over the loose bracket or poking wire to protect your cheeks and lips.\n"
                    "2. **Leave It Attached If Connected**: If the bracket is still attached to the wire, leave it in place rather than pulling on it. Never cut an archwire with household clippers.\n"
                    "3. **Eat Soft Foods**: Stick to soft foods (yogurt, soup, mashed items) and avoid sticky, crunchy, or hard snacks.\n"
                    "4. **Schedule a Repair Visit**: Book an appointment so your orthodontist can rebond the bracket cleanly.\n\n"
                    "👉 [Book an Orthodontic Checkup](/patient/book)"
                ),
                "followUps": [
                    "How do I book an orthodontic adjustment?",
                    "Where can I see my orthodontic treatment progress?",
                    "Where can I see my scheduled appointments?"
                ]
            }

        if re.search(r"\b(orthodontics?|treatment.*progress|aligners?|braces?|trays?|milestones?|retainers?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 📈 Your Orthodontic & Treatment Progress\n\n"
                    "Tracking your braces or clear aligners journey in SmileGuard AI is easy on **[Treatment Progress](/patient/treatment)**:\n\n"
                    "- 🦷 **Current Stage**: View your active milestone (e.g., *Initial Alignment*, *Space Closure*, *Bite Correction*, or *Retention*).\n"
                    "- 📊 **Progress Ring & Timeline**: Monitor your overall completion percentage and step-by-step stage schedule.\n"
                    "- 📝 **Dentist Notes**: Review clinical updates recorded by your attending practitioner.\n\n"
                    "👉 [View My Treatment Progress](/patient/treatment)"
                ),
                "followUps": [
                    "How do I book an orthodontic adjustment?",
                    "How should I clean my aligners or retainers?",
                    "What should I do if a bracket comes loose?"
                ]
            }

        if re.search(r"\b(operating\s*hours|clinic\s*hours|open(ing)?\s*hours|business\s*hours|what\s*time|hours)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🕒 Clinic Appointment Time Slots\n\n"
                    "Available booking time slots in SmileGuard AI run from **09:00 AM to 05:00 PM**:\n\n"
                    "- **Morning Slots**: `09:00 AM`, `10:00 AM`, `11:00 AM`\n"
                    "- **Afternoon Slots**: `01:00 PM`, `02:00 PM`, `03:00 PM`, `04:00 PM`, `05:00 PM`\n\n"
                    "You can view live dentist-specific slot availability when scheduling in **[Book Appointment](/patient/book)** or manage existing visits in **[My Appointments](/patient/appointments)**."
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "Where can I see my scheduled appointments?",
                    "What do I do if I have a toothache?"
                ]
            }

        if re.search(r"\b(book(ing|s)?|appointments?|schedules?|scheduled|scheduling|reserve|slots?|consultations?|visits?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 📅 How to Book an Appointment in SmileGuard AI\n\n"
                    "Booking a visit takes just a few clicks through our dynamic 3-step wizard:\n\n"
                    "1. **Select Procedure**: Pick the service you need (*Oral Prophylaxis / Cleaning*, *Dental Fillings*, *Ortho Braces*, *Root Canal Treatment*, *Tooth Extraction*, etc.).\n"
                    "2. **Choose Dentist**: Select your preferred dental clinician.\n"
                    "3. **Pick Date & Time**: Choose any open slot (`09:00 AM` – `05:00 PM`). The system automatically validates against existing schedules to prevent double-booking!\n\n"
                    "👉 [Book an Appointment Now](/patient/book) or view existing visits in [My Appointments](/patient/appointments)"
                ),
                "followUps": [
                    "Where can I see my scheduled appointments?",
                    "What do I do if I have a toothache?",
                    "What are the clinic operating hours?"
                ]
            }

        if re.search(r"\b(toothaches?|tooth\s*pain|teeth\s*hurt|masakit.*ngipin|pulpitis|aching\s*tooth|sensitive\s*tooth|sensitive\s*teeth|tooth\s*sensitivity|pangingilo|ngilo|swollen\s*cheek|mouth\s*pain)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Relief & Care for Toothache or Tooth Sensitivity\n\n"
                    "Tooth pain usually indicates deep decay, enamel wear, or nerve inflammation. Here is immediate guidance:\n\n"
                    "1. **Warm Salt Water Rinse**: Dissolve 1/2 tsp of salt in warm water. Swish gently for 30 seconds to clean bacteria and soothe gums.\n"
                    "2. **Cold Compress**: Place an ice pack wrapped in a towel against your cheek (15 mins on, 15 mins off) to reduce throbbing and swelling.\n"
                    "3. **Avoid Trigger Foods**: Steer clear of very cold, hot, sweet, or acidic foods and drinks that shock the exposed dentin/nerve.\n"
                    "4. **Pain Relief Caution**: Over-the-counter pain relievers can help temporarily, but **never** place an aspirin tablet directly against gums as it causes chemical burns.\n\n"
                    "⚠️ *A toothache will not heal on its own. It's best to have your dentist inspect the tooth before minor decay reaches the nerve!*\n\n"
                    "👉 [Book an Appointment with a Dentist](/patient/book)"
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "What are the signs of a cavity?",
                    "What is a root canal procedure?"
                ]
            }

        if re.search(r"\bdifference\b.*\b(fillings?|root\s*canals?)\b|\bfillings?\b.*\b(vs|versus|or)\b.*\broot\s*canals?\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Dental Filling vs. Root Canal Treatment\n\n"
                    "The right treatment depends on how deep the decay or damage reaches inside your tooth:\n\n"
                    "- **Dental Filling (Pasta)** *(30–60 mins)*: Used for mild to moderate cavities affecting only the outer **enamel** or middle **dentin**. The dentist removes decay and seals the area with tooth-colored composite resin.\n"
                    "- **Root Canal Treatment (Endodontics)** *(60–90 mins)*: Required when deep decay, cracks, or trauma infects the inner **pulp (nerve)**. The dentist removes the infected pulp, disinfects and seals the root canals, and typically protects the tooth with a crown.\n\n"
                    "👉 [Book a Dental Consultation](/patient/book) for an accurate chairside exam and radiograph check."
                ),
                "followUps": [
                    "What are the signs of a tooth infection?",
                    "What are the signs of a cavity?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(signs?|symptoms?)\b.*\b(infections?|abscess(es)?)\b|\btooth\s+infections?\b|\bperiapical\b|\babscess(es)?\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🚨 Signs of a Tooth Infection (Abscess)\n\n"
                    "Common warning signs of a dental or periapical infection include:\n\n"
                    "- **Persistent Throbbing Pain**: Aching that radiates to the jaw, ear, or neck, often worsening when lying down or biting.\n"
                    "- **Gum or Cheek Swelling**: Localized puffiness or a small pimple-like bump on the gums that may release foul-tasting fluid.\n"
                    "- **Extreme Temperature & Pressure Sensitivity**: Lingering pain to hot/cold drinks or chewing.\n"
                    "- **Fever or Swollen Lymph Nodes**: Signs that your body is fighting spreading inflammation.\n\n"
                    "⚠️ *Seek urgent care immediately if swelling spreads toward your eye or neck, or causes difficulty swallowing or breathing.*\n\n"
                    "👉 [Book an Urgent Consultation](/patient/book)"
                ),
                "followUps": [
                    "What does a root canal involve?",
                    "What do I do if I have a toothache?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\btoothbrush(es)?\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🪥 Choosing & Replacing Your Toothbrush\n\n"
                    "- **Best Type to Use**: Choose a **soft-bristled** manual or electric toothbrush sized comfortably for your mouth. Medium or hard bristles can scrub away protective enamel and cause gum recession.\n"
                    "- **When to Replace**: Replace your toothbrush (or electric brush head) every **3 months**, or sooner if the bristles become frayed/splayed or right after recovering from a cold, flu, or mouth infection.\n"
                    "- **Toothpaste Pairing**: Always pair it with **fluoride toothpaste** and brush gently for a full 2 minutes twice daily.\n\n"
                    "👉 Practice with our 2-minute timer on your [Patient Portal](/patient)!"
                ),
                "followUps": [
                    "What is the proper way to brush teeth?",
                    "How do daily brushing streaks work?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(proper|right|correct|how\s+to|way\s+(to|of))\b.*\b(brush(ing)?|floss(ing)?)\b|\bkeep\s+(my\s+)?teeth\s+clean\b|\bfloss(ing)?\b|\btechnique\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🪥 Proper Brushing, Flossing & Daily Oral Hygiene\n\n"
                    "1. **Angle at 45 Degrees**: Aim soft bristles at a 45° angle toward your gumline.\n"
                    "2. **Gentle Circular Strokes**: Brush gently for **2 full minutes** (30 seconds per quadrant) morning and night—scrubbing hard wears down enamel.\n"
                    "3. **Clean Your Tongue**: Gently brush or scrape your tongue to remove odor-causing bacteria.\n"
                    "4. **Floss Once Daily**: Curve floss into a **\"C\" shape** hugging each tooth and slide gently beneath the gumline to remove trapped plaque.\n"
                    "5. **Routine Checkups**: Pair daily habits with professional cleanings every 6 months.\n\n"
                    "👉 Track your AM/PM sessions on your [Patient Portal](/patient) or [Book a Cleaning](/patient/book)!"
                ),
                "followUps": [
                    "How do daily brushing streaks work?",
                    "How often should I change my toothbrush?",
                    "What is a dental cleaning procedure?"
                ]
            }

        if re.search(r"\b(brush(ing)?|streaks?|habits?|gardy\s*mascot|timers?|2[\s-]minute|morning\s*sessions?|evening\s*sessions?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🪥 Daily Brushing Streaks & Gardy Mascot\n\n"
                    "SmileGuard AI turns everyday oral hygiene into a fun, rewarding daily habit:\n\n"
                    "- ☀️ **Morning Session (AM)**: Log your morning brush to protect teeth from daytime plaque.\n"
                    "- 🌙 **Evening Session (PM)**: Log your nighttime brush before sleep to stop overnight acid buildup.\n"
                    "- ⏱️ **Interactive 2-Minute Timer**: Follow our guided quadrant timer across top, bottom, front, and chewing surfaces.\n"
                    "- 🏆 **Streak Badges**: Build consecutive days to unlock milestone badges and keep **Gardy** cheering!\n\n"
                    "👉 Head to your [Patient Portal](/patient) to log today's brushing session!"
                ),
                "followUps": [
                    "What is the proper way to brush teeth?",
                    "How often should I change my toothbrush?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(cleanings?|prophylaxis|scaling|tartar|plaque|calculus|linis)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Dental Cleaning (Oral Prophylaxis)\n\n"
                    "Regular professional dental cleanings are the foundation of preventive dental care:\n\n"
                    "- **What it does**: Removes hardened tartar (calculus) and bacterial plaque that normal brushing cannot reach, followed by polishing.\n"
                    "- **Recommended Frequency**: Every 6 months for most patients, or every 3–4 months if you have braces or a history of gum disease.\n"
                    "- **Benefits**: Prevents bleeding gums, stops decay between teeth, and keeps breath fresh.\n\n"
                    "👉 [Book Oral Prophylaxis (Cleaning)](/patient/book)"
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "How do I prevent bleeding gums?",
                    "What causes bad breath?"
                ]
            }

        if re.search(r"\b(cavity|cavities|decay|caries|fillings?|pasta|demineraliz\w*)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Cavities & Dental Fillings (Pasta)\n\n"
                    "- **What causes cavities?**: Bacteria in plaque feed on sugars and produce acids that dissolve tooth enamel.\n"
                    "- **Common Signs**: Sensitivity to sweet/cold/hot foods, dark or chalky spots on teeth, food catching between teeth, or sharp pain when biting.\n"
                    "- **Treatment**: The dentist gently removes decayed tissue and restores the tooth with tooth-colored composite resin (*Oral Fillings / Pasta*).\n"
                    "- **Prevention**: Brush twice daily with fluoride toothpaste, floss daily, and attend regular checkups.\n\n"
                    "👉 [Book a Dental Consultation](/patient/book)"
                ),
                "followUps": [
                    "What do I do if I have a toothache?",
                    "What is the difference between a filling and a root canal?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(gums?.*bleed\w*|bleed\w*.*gums?|swollen.*gums?|gingivitis|periodont\w*)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🩸 Bleeding or Swollen Gums (Gingivitis)\n\n"
                    "Healthy gums should **never** bleed during normal brushing or flossing!\n\n"
                    "- **Main Cause**: Plaque and tartar irritating the gumline (early-stage gum disease / gingivitis).\n"
                    "- **What to do**:\n"
                    "  1. Do NOT stop brushing or flossing — gently clean along the gumline using a **soft-bristled** brush.\n"
                    "  2. Rinse with warm salt water after meals.\n"
                    "  3. Schedule a professional cleaning (scaling) to remove hardened tartar.\n\n"
                    "👉 [Book a Dental Cleaning](/patient/book) to protect your gums and bone support!"
                ),
                "followUps": [
                    "What is a dental cleaning procedure?",
                    "What is the proper way to brush teeth?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(wisdom|impacted|extractions?|bunot|pull.*tooth|extract(ed|ing)?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Wisdom Teeth & Tooth Extraction\n\n"
                    "- **Impacted Wisdom Teeth**: Often lack room in the jaw, growing angled or trapped under bone/gums and causing swelling or crowding.\n"
                    "- **Evaluation**: Assessed with panoramic dental X-rays (OPG) in SmileGuard AI to inspect root position.\n"
                    "- **Post-Extraction Home Care**:\n"
                    "  * Bite firmly on sterile gauze for 45 minutes.\n"
                    "  * Avoid forceful spitting, smoking, or using a straw for 48 hours (prevents painful *Dry Socket*).\n"
                    "  * Stick to soft, cool foods on Day 1.\n\n"
                    "👉 [Book an Examination](/patient/book)"
                ),
                "followUps": [
                    "What do I do if I have a toothache?",
                    "What does the AI dental X-ray diagnosis mean?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(root\s*canals?|rct|endodontic\w*|patay.*ngipin|nerve.*tooth)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🦷 Root Canal Treatment (Endodontics)\n\n"
                    "A root canal is performed to **save** a natural tooth whose inner nerve/pulp is inflamed or infected:\n\n"
                    "1. **Local Anesthesia**: The tooth is thoroughly numbed so you stay comfortable.\n"
                    "2. **Clean Infected Pulp**: Inflamed or infected tissue inside the root canals is carefully removed.\n"
                    "3. **Disinfect & Seal**: Canals are shaped, disinfected, and sealed with biocompatible gutta-percha.\n"
                    "4. **Protective Restoration**: A filling or crown protects the tooth from future fracture.\n\n"
                    "👉 [Book a Root Canal Consultation](/patient/book)"
                ),
                "followUps": [
                    "What are the signs of a tooth infection?",
                    "What is the difference between a filling and a root canal?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(whiten(ing)?|bleach(ing)?|yellow.*teeth|maputi|white.*teeth|stains?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### ✨ Teeth Whitening & Brightening\n\n"
                    "- **Is whitening safe for enamel?**: Dentist-supervised whitening uses controlled peroxide formulas that lift stains safely without damaging healthy tooth structure, though temporary tooth sensitivity can occur.\n"
                    "- **Before Whitening**: Active cavities or gum inflammation should always be treated first.\n"
                    "- **Preventing Stains**: Rinse with water after coffee, tea, or dark sodas, and keep up with routine dental cleanings.\n\n"
                    "👉 [Book a Consultation](/patient/book) to ask your dentist which option fits your teeth."
                ),
                "followUps": [
                    "What is a dental cleaning procedure?",
                    "How do I keep my teeth clean?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(bad\s*breath|halitosis|hininga)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🌿 Tips for Fresh Breath (Halitosis Relief)\n\n"
                    "Bad breath is most commonly caused by odor-producing bacteria on the tongue and between teeth:\n\n"
                    "1. **Clean Your Tongue**: Brush or gently scrape the back of your tongue daily.\n"
                    "2. **Floss Daily**: Remove trapped food particles and plaque between teeth.\n"
                    "3. **Stay Hydrated**: Drinking water supports saliva flow to wash away bacteria.\n"
                    "4. **Professional Scaling**: Hardened tartar under gums harbors bacteria that mouthwash alone cannot fix.\n\n"
                    "👉 [Book a Dental Cleaning](/patient/book)"
                ),
                "followUps": [
                    "What is the proper way to floss?",
                    "What is a dental cleaning procedure?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\bai\b.*\b(x-?rays?|xrays?|diagnos\w*|opg)\b|\b(x-?rays?|xrays?)\s+diagnosis\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🔬 Understanding Your AI Dental X-Ray Screening\n\n"
                    "When your dentist reviews your panoramic dental X-ray (OPG) in SmileGuard AI, our **Two-Stage CNN model** provides assistive screening highlights:\n\n"
                    "- **Stage 1 (OPG Check)**: Confirms the scan is a valid panoramic dental radiograph.\n"
                    "- **Stage 2 (Pathology Screening)**: Highlights potential patterns such as cavities (*Caries*), *Impacted teeth*, *Infection*, *BDC-BDR*, or *Healthy Teeth*, along with a visual attention heatmap.\n"
                    "- **Your Dentist Confirms Everything**: You can view shared radiographs anytime in **[Dental Records](/patient/records)**.\n\n"
                    "> ⚠️ *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
                ),
                "followUps": [
                    "Where can I see my dental records?",
                    "Where can I see my scheduled appointments?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(records?|x-?rays?|xrays?|opgs?|radiographs?|case\s*files?|pictures?|imaging)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 📂 Your Dental Records & Radiographs\n\n"
                    "All radiographs and imaging uploaded to your patient chart are available in **[Dental Records](/patient/records)**:\n\n"
                    "- 🖼️ **Panoramic Radiographs (OPG) & Imaging**: Inspect your dental X-rays with interactive zoom, rotation, contrast, and invert tools.\n"
                    "- 📋 **Clinical Notes**: Review diagnostic notes attached by your attending dentist.\n"
                    "- 🔒 **Data Privacy**: Protected under the Philippine Data Privacy Act of 2012 (RA 10173).\n\n"
                    "👉 [Open My Dental Records](/patient/records)"
                ),
                "followUps": [
                    "What does the AI dental X-ray diagnosis mean?",
                    "Where can I see my scheduled appointments?",
                    "Where can I see my orthodontic treatment progress?"
                ]
            }

        if re.search(r"\b(10173|ra\s*10173|data\s*privacy|privacy|onboarding|consents?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🔒 Your Privacy & RA 10173 Compliance\n\n"
                    "SmileGuard AI protects your personal and clinical records under the **Philippine Data Privacy Act of 2012 (Republic Act No. 10173)**:\n\n"
                    "- **Informed Consent**: During patient onboarding, you provide explicit consent before your medical and dental history is stored.\n"
                    "- **Private Portal Access**: Only you and authorized clinic staff treating you can view your chart and radiographs in **[Dental Records](/patient/records)**.\n\n"
                    "👉 [View Dental Records](/patient/records) or [Manage Profile Settings](/patient/profile)"
                ),
                "followUps": [
                    "Where can I see my dental records?",
                    "Where can I see my scheduled appointments?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(profiles?|passwords?|accounts?|settings?|emergency\s*contacts?|phone\s*numbers?)\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### ⚙️ Managing Your Account Settings\n\n"
                    "You can update your personal credentials and preferences anytime in **[Profile & Settings](/patient/profile)**:\n\n"
                    "- 👤 **Contact Details**: Update your mobile number and emergency contact details.\n"
                    "- 🔒 **Password & Security**: Manage your portal login credentials.\n"
                    "- 🎨 **Theme Preferences**: Toggle Light/Dark mode.\n\n"
                    "👉 [Go to Profile & Account Settings](/patient/profile)"
                ),
                "followUps": [
                    "Where can I see my scheduled appointments?",
                    "Where can I see my dental records?",
                    "How do I book an appointment?"
                ]
            }

        if re.search(r"\b(smileguard|features?|systems?|what\s*(is|can)\s*(this|you))\b", msg):
            return {
                "content": (
                    f"{emergency_prefix}### 🌟 Welcome to SmileGuard AI!\n\n"
                    "**SmileGuard AI** makes managing your dental care smooth, transparent, and proactive:\n\n"
                    "- 📅 **3-Step Appointment Booking**: Schedule visits at [Book Appointment](/patient/book) and track them in [My Appointments](/patient/appointments).\n"
                    "- 🪥 **Daily Brushing Streaks**: Build healthy habits with our 2-minute timer and **Gardy** mascot on [Patient Portal](/patient).\n"
                    "- 📈 **Orthodontic Timeline**: Track braces/aligner milestones in [Treatment Progress](/patient/treatment).\n"
                    "- 📂 **Radiology Records**: View your dental scans in [Dental Records](/patient/records).\n"
                    "- 🔒 **Privacy Protection**: Built with RA 10173 (Philippine Data Privacy Act) consent and safeguards.\n\n"
                    "What would you like to explore first?"
                ),
                "followUps": [
                    "How do I book an appointment?",
                    "Where can I see my scheduled appointments?",
                    "How do daily brushing streaks work?"
                ]
            }

        return {
            "content": (
                f"{emergency_prefix}Hello! I'm **Gardy Assistant**, your SmileGuard AI dental companion! 😊\n\n"
                "I can help you with dental care and navigating your patient portal:\n\n"
                "- 📅 **Appointments**: [Book a Visit](/patient/book) or view [My Scheduled Appointments](/patient/appointments).\n"
                "- 🪥 **Oral Hygiene**: Brushing streaks, proper brushing/flossing tips, and toothache care.\n"
                "- 📈 **Orthodontics**: Track braces/aligner milestones in [Treatment Progress](/patient/treatment).\n"
                "- 📂 **Imaging & Records**: View your X-rays in [Dental Records](/patient/records).\n\n"
                "What can I help you with today?"
            ),
            "followUps": [
                "How do I book an appointment?",
                "Where can I see my scheduled appointments?",
                "Where can I see my orthodontic treatment progress?",
                "What do I do if I have a toothache?"
            ]
        }

    # Clinical / Staff / Lab / Admin / Visitor Branch
    if re.search(r"clinical significance.*radiographical indicators|explain.*differential considerations", msg):
        content = (
            f"{emergency_prefix}### 🔬 Radiographic Findings & Clinical Significance\n\n"
            "When evaluating pathology on a dental panoramic radiograph (OPG) within SmileGuard AI:\n\n"
            "1. **Diagnostic Decision Support Interpretation**:\n"
            "   - Correlate the neural prediction with the anatomical quadrant and tooth surface.\n"
            "   - Inspect the **Pre-Softmax Grad-CAM Heatmap** (layer `top_activation`) to observe which radiolucent or radiopaque pixels influenced the model.\n\n"
            "2. **Clinical Correlation Required**:\n"
            "   - Check tooth vitality (thermal/electric pulp test) and percussion response.\n"
            "   - Examine coronal margins for restoration breakdown or secondary demineralization.\n"
            "   - Obtain targeted periapical or bitewing radiographs for definitive interproximal evaluation.\n\n"
            "3. **Recommended Next Steps**:\n"
            "   - Log clinician verification in the sign-off panel.\n"
            "   - [Open AI Workstation](/clinic/ai-workstation) • [View Patient Directory](/clinic/patients)\n\n"
            "> ⚠️ **Clinical Decision Support Disclaimer**:\n"
            "> *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
        )
        return {
            "content": content,
            "followUps": [
                "How do I copy a SOAP clinical note for this finding?",
                "How does pre-softmax Grad-CAM avoid saturation?",
                "What are the classification confidence thresholds?"
            ]
        }

    if re.search(r"\bsoap\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📋 Copying a Structured SOAP Clinical Note\n\n"
                "You can export any clinical AI assistant reply as a ready-to-paste SOAP note:\n\n"
                "1. Hover over any clinical response bubble in **Gardy Assistant**.\n"
                "2. Click the **SOAP** button next to the copy icon at the bottom-right of the message.\n"
                "3. SmileGuard automatically formats **[S] Subjective**, **[O] Objective**, **[A] Assessment**, and **[P] Plan** sections with timestamp, author role, and clinical disclaimer onto your clipboard.\n\n"
                "👉 [Open AI Workstation](/clinic/ai-workstation)"
            ),
            "followUps": [
                "How does pre-softmax Grad-CAM avoid saturation?",
                "What are the classification confidence thresholds?",
                "How do I use the 32-tooth interactive odontogram?"
            ]
        }

    if re.search(r"\b(non-opg|invalid_xray|rejected.*(non-opg|opg|images?|x-?rays?))\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🚫 Why Non-OPG Images Are Rejected (Stage-1 Gatekeeper)\n\n"
                "Every image uploaded to the **AI Diagnostic Workstation** first passes through our **Stage-1 OPG Validator** (`EfficientNetB0`) calibrated at a **`0.60` decision threshold**:\n\n"
                "- **Trigger**: If the predicted `dental_opg` probability is below `60%`, the backend halts inference and returns `status: \"invalid_xray\"` (`INVALID_XRAY_IMAGE`).\n"
                "- **Zero Fabrication Guarantee**: Photographs, selfies, screenshots, ID cards, or heavily cropped/non-panoramic images never reach Stage 2 or generate misleading Grad-CAM heatmaps.\n"
                "- **How to Resolve**: Re-upload an unobstructed panoramic dental radiograph (OPG) showing the full dental arches in [Open AI Workstation](/clinic/ai-workstation)."
            ),
            "followUps": [
                "How does the two-stage CNN validator work?",
                "What does the AI dental X-ray diagnosis mean?",
                "What are the classification confidence thresholds?"
            ]
        }

    if re.search(r"\b(two[\s-]*stage|stage[\s-]*1|validators?|gatekeepers?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🛡️ How the Two-Stage CNN Validator & Pipeline Works\n\n"
                "SmileGuard AI runs incoming radiographs through two sequential **`EfficientNetB0`** models:\n\n"
                "1. **Stage 1 — Binary OPG Gatekeeper (`0.60` threshold)**: Checks whether the input is a genuine Dental Panoramic Radiograph (`dental_opg` vs. `non_opg`). Anything below `0.60` is rejected immediately as `invalid_xray`.\n"
                "2. **Stage 2 — 6-Class Pathology Classifier**: Runs **only** on verified OPGs to score `BDC-BDR`, `Caries`, `Fractured Teeth`, `Healthy Teeth`, `Impacted teeth`, and `Infection`.\n"
                "3. **Explainability Overlay**: Computes **pre-softmax Grad-CAM** on `top_activation` for clinician verification in [Open AI Workstation](/clinic/ai-workstation).\n\n"
                "> ⚠️ *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
            ),
            "followUps": [
                "Why was an image rejected as Non-OPG?",
                "What is pre-softmax Grad-CAM explainability?",
                "What does the AI dental X-ray diagnosis mean?"
            ]
        }

    if re.search(r"\b(grad[\s-]*cam|pre-softmax|saturation|top_activation|heatmaps?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🎯 Pre-Softmax Grad-CAM & Radiograph Attention Mapping\n\n"
                "- **Avoiding Softmax Saturation**: In offline verification (`gradcam.py`), gradients $\\partial y^c / \\partial A^k$ are computed from **linear pre-softmax logits** ($y^c$) rather than post-softmax probabilities, preventing gradient vanishing when confidence is high.\n"
                "- **Target Layer**: Targets EfficientNetB0's final convolutional activation tensor **`top_activation`** (`7 × 7 × 1280`) to highlight focal anatomical regions.\n"
                "- **Workstation Controls**: In [Open AI Workstation](/clinic/ai-workstation), use the **Heatmap Opacity** slider (`0%–100%`), download the blended overlay image, or export a printable PDF diagnostic report.\n\n"
                "> ⚠️ *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
            ),
            "followUps": [
                "How does the two-stage CNN validator work?",
                "What are the classification confidence thresholds?",
                "How do I copy a SOAP clinical note for this finding?"
            ]
        }

    if re.search(r"\b(confidence\s*thresholds?|classification\s*confidence|thresholds?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📊 Classification & Validation Thresholds\n\n"
                "- **Stage 1 Validator Threshold (`0.60` / `60%`)**: Calibrated strictly on the held-out validation set to maximize F1-score. Images scoring `< 0.60` for `dental_opg` are rejected before Stage 2 runs.\n"
                "- **Stage 2 Pathology Softmax Output**: Produces a normalized 6-class probability distribution summing to **`100%`** across `BDC-BDR`, `Caries`, `Fractured Teeth`, `Healthy Teeth`, `Impacted teeth`, and `Infection`.\n"
                "- **Decision-Support Rule**: SmileGuard AI ranks all 6 probabilities rather than issuing an automated diagnosis—every result requires **clinician verification and sign-off**.\n\n"
                "👉 [Open AI Workstation](/clinic/ai-workstation)"
            ),
            "followUps": [
                "How does the two-stage CNN validator work?",
                "What is pre-softmax Grad-CAM explainability?",
                "How do I copy a SOAP clinical note for this finding?"
            ]
        }

    if re.search(r"\b(ai\s*workstation|diagnostic\s*workstation|x-?rays?|xrays?|opgs?|diagnosis|diagnostics?|caries|impacted|infections?|cnn)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🔬 SmileGuard Two-Stage CNN Diagnostic Pipeline\n\n"
                "1. **Stage 1: OPG Validator Gatekeeper (EfficientNetB0)**\n"
                "   - Verifies whether the uploaded image is an authentic Dental Panoramic Radiograph (OPG) using a `0.60` decision threshold.\n"
                "   - Non-OPG images (photos, selfies, documents) are rejected (`INVALID_XRAY_IMAGE`) with **zero pathology output**.\n\n"
                "2. **Stage 2: 6-Class Pathology Classifier (EfficientNetB0)**\n"
                "   - Evaluates verified OPGs across **BDC-BDR**, **Caries**, **Fractured Teeth**, **Healthy Teeth**, **Impacted teeth**, and **Infection**.\n\n"
                "3. **Explainability & Clinician Sign-Off**:\n"
                "   - Displays ranked softmax probabilities, interactive attention heatmap overlay, PDF report export, and chart sign-off in [Open AI Workstation](/clinic/ai-workstation).\n\n"
                "> ⚠️ **Clinical Decision Support Disclaimer**:\n"
                "> *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
            ),
            "followUps": [
                "How does the two-stage CNN validator work?",
                "What is pre-softmax Grad-CAM explainability?",
                "Why was an image rejected as Non-OPG?"
            ]
        }

    if re.search(r"\bdouble[\s-]*booking\b|\bconflict\s*prevention\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🛡️ Double-Booking Conflict Prevention\n\n"
                "SmileGuard AI automatically prevents scheduling overlaps for the same dental practitioner:\n\n"
                "- **Patient Booking Wizard**: Already-occupied time slots for the selected dentist and date are checked and blocked before a request is saved.\n"
                "- **Clinic Queue & Rescheduling**: When confirming or rescheduling an appointment in [View Appointments Queue](/clinic/queue), the service validates against existing `PENDING`, `CONFIRMED`, and `IN_CHAIR` bookings for that dentist, date, and slot."
            ),
            "followUps": [
                "How do I manage patient appointments in the queue?",
                "When should a patient be moved to IN_CHAIR?",
                "How do I decline an appointment with a clinical reason?"
            ]
        }

    if re.search(r"\bin_chair\b|\bin\s+chair\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🪑 Moving an Appointment to `IN_CHAIR`\n\n"
                "In the **[Appointments Queue](/clinic/queue)**:\n\n"
                "1. Locate the patient's **`CONFIRMED`** booking once they arrive and are seated in the dental operatory.\n"
                "2. Advance their status to **`IN_CHAIR`** to indicate active chairside treatment is underway.\n"
                "3. When the procedure finishes, mark the visit **`COMPLETED`** so clinical records and patient history update in real time."
            ),
            "followUps": [
                "How do I manage patient appointments in the queue?",
                "How does double-booking prevention work?",
                "How do I decline an appointment with a clinical reason?"
            ]
        }

    if re.search(r"\b(decline|reject)\b.*\b(appointments?|reasons?|bookings?)\b|\bclinical\s*reasons?\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### ❌ Declining an Appointment With a Clinical Reason\n\n"
                "To decline an appointment request safely in **[Appointments Queue](/clinic/queue)**:\n\n"
                "1. Click **Decline / Reject** on a `PENDING` or `CONFIRMED` appointment.\n"
                "2. Select a predefined operational/clinical reason (e.g., *Dentist attending emergency*, *Pre-procedure dental X-ray required first*, *Double-booking conflict*) or enter custom clinical notes.\n"
                "3. Confirm the checkpoint—the patient sees the decline reason directly in their **My Appointments** view and receives a notification."
            ),
            "followUps": [
                "How do I manage patient appointments in the queue?",
                "How does double-booking prevention work?",
                "When should a patient be moved to IN_CHAIR?"
            ]
        }

    if re.search(r"\b(operating\s*hours|clinic\s*hours|open(ing)?\s*hours|business\s*hours|what\s*time|hours)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🕒 Clinic Operating Hours & Booking Slots\n\n"
                "SmileGuard AI appointment scheduling operates from **09:00 AM to 05:00 PM**:\n\n"
                "- **Morning Slots**: `09:00 AM`, `10:00 AM`, `11:00 AM`\n"
                "- **Afternoon Slots**: `01:00 PM`, `02:00 PM`, `03:00 PM`, `04:00 PM`, `05:00 PM`\n\n"
                "- **Patients**: Book or view open slots in **[Book Appointment](/patient/book)** and track upcoming visits in **[My Appointments](/patient/appointments)**.\n"
                "- **Clinic Staff**: Manage the live daily schedule and chairside queue in **[Appointments Queue](/clinic/queue)**."
            ),
            "followUps": [
                "Where can I see my scheduled appointments?",
                "How do I book an appointment?",
                "How do I manage patient appointments?"
            ]
        }

    if (
        (
            re.search(r"\b(my|scheduled|upcoming|past|cancelled)\s+(appointments?|visits?|bookings?)\b|\bwhere\b.*\b(see|view|check|find)\b.*\bscheduled\s+appointments?\b", msg)
            or (normalized_role == "GUEST" and bool(re.search(r"\b(reschedule|cancel)\b.*\b(appointments?|bookings?|visits?)\b", msg)))
        )
        and not re.search(r"\b(queues?|manage\s+patients?)\b", msg)
    ):
        return {
            "content": (
                f"{emergency_prefix}### 📆 Viewing Scheduled Appointments\n\n"
                "- **Patients**: Go to **[My Appointments](/patient/appointments)** to view Upcoming (`PENDING`/`CONFIRMED`), Past (`COMPLETED`), and Cancelled/Rejected visits, or click **Reschedule** / **Cancel** on any upcoming booking.\n"
                "- **Clinic Staff**: Manage the live operatory schedule and patient triage list in **[Appointments Queue](/clinic/queue)**."
            ),
            "followUps": [
                "How do I book an appointment?",
                "How do I manage patient appointments?",
                "What are the clinic operating hours?"
            ]
        }

    if (
        normalized_role == "GUEST"
        and re.search(r"\b(how\s+do\s+i|how\s+to)\s+book\b|\bbook\s+an\s+appointment\b", msg)
        and not re.search(r"\b(queues?|manage\s+patients?)\b", msg)
    ):
        return {
            "content": (
                f"{emergency_prefix}### 📅 How to Book an Appointment in SmileGuard AI\n\n"
                "Booking a visit as a patient takes just 3 steps in **[Book Appointment](/patient/book)**:\n\n"
                "1. **Select Procedure**: Pick the dental service (*Oral Prophylaxis / Cleaning*, *Dental Fillings*, *Ortho Braces*, *Root Canal Treatment*, etc.).\n"
                "2. **Choose Dentist**: Select your preferred clinician.\n"
                "3. **Pick Date & Time**: Choose an open slot (`09:00 AM` – `05:00 PM`) with automatic conflict checks.\n\n"
                "👉 Sign in or register to open **[Book Appointment](/patient/book)** or view **[My Appointments](/patient/appointments)**."
            ),
            "followUps": [
                "Where can I see my scheduled appointments?",
                "What features are available in SmileGuard AI?",
                "What does the AI dental X-ray diagnosis mean?"
            ]
        }

    if re.search(r"\b(appointments?|bookings?|schedules?|scheduled|scheduling|queues?|triage)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📅 Managing Patient Appointments in SmileGuard AI\n\n"
                "1. **Chairside Triage Queue ([View Appointments Queue](/clinic/queue))**:\n"
                "   - Review incoming booking requests in real time with filters by status, dentist, and date range.\n"
                "   - Stage progression: `PENDING` ➔ `CONFIRMED` ➔ `IN_CHAIR` ➔ `COMPLETED` (or `REJECTED` / `CANCELLED` with a documented reason).\n\n"
                "2. **Conflict Prevention & Rescheduling**:\n"
                "   - Automatically detects and blocks double-booking for the same dentist and time slot (`09:00 AM` – `05:00 PM`).\n\n"
                "3. **Patient Self-Service**:\n"
                "   - Patients book via `/patient/book` and manage upcoming visits in `/patient/appointments`."
            ),
            "followUps": [
                "How does double-booking prevention work?",
                "When should a patient be moved to IN_CHAIR?",
                "How do I decline an appointment with a clinical reason?"
            ]
        }

    if re.search(r"\b(provision|create|add)\b.*\b(dentists?|staff|lab|admins?|users?|accounts?)\b|\buser\s*management\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 👥 Provisioning Staff & Dentist Accounts\n\n"
                "Because self-registration strictly locks new accounts to `PATIENT`, clinical staff are provisioned by an administrator in **[User Management](/admin/users)**:\n\n"
                "1. Open **[User Management](/admin/users)** as `ADMIN` or `SUPERADMIN`.\n"
                "2. Click **Provision Staff Member** and choose the target role (`DENTIST`, `RECEPTIONIST`, `LAB_TECH`, or `ADMIN`).\n"
                "3. Enter full name, email, and clinical credentials (such as license number & specialty for dentists).\n"
                "4. You can also activate/deactivate accounts or manage permissions, with all changes logged to the audit trail."
            ),
            "followUps": [
                "How do I inspect clinic security and activity logs?",
                "What user roles are supported in SmileGuard AI?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if re.search(r"\b(activity\s*logs?|security\s*logs?|audit\s*(logs?|trails?)|inspect.*logs?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🛡️ Inspecting Clinic Security & Activity Logs\n\n"
                "Administrators can monitor the immutable audit stream in **[Activity & Security Logs](/admin/logs)**:\n\n"
                "- **Tracked Events**: Staff provisioning, role changes, appointment approvals/cancellations, lab stage updates, and authentication events.\n"
                "- **Search & Filter**: Filter entries by **actor**, **action type**, or **entity** and click **Refresh Audit Trail** for live updates.\n"
                "- **Compliance**: Supports accountability and RA 10173 data access auditing."
            ),
            "followUps": [
                "How do I provision new dentist accounts?",
                "What user roles are supported in SmileGuard AI?",
                "How does medical onboarding comply with RA 10173?"
            ]
        }

    if re.search(r"\b(user\s*roles?|supported\s*roles?|roles?\s*supported|rbac)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🔐 Supported User Roles & Portal Boundaries (RBAC)\n\n"
                "SmileGuard AI enforces server-authoritative Firestore role boundaries across **6 roles**:\n\n"
                "- **`PATIENT`**: Personal dashboard, 3-step appointment booking, treatment timeline, dental records, and brushing streaks (`/patient`).\n"
                "- **`DENTIST`**: Appointment queue, patient directory, 32-tooth odontogram, treatment plans, lab orders, and AI Workstation (`/clinic`).\n"
                "- **`RECEPTIONIST`**: Clinic triage queue, scheduling, and patient directory (`/clinic`).\n"
                "- **`LAB_TECH`**: Dental laboratory intake, production board, QC, and dispatch (`/lab`).\n"
                "- **`ADMIN`** & **`SUPERADMIN`**: Staff provisioning (`/admin/users`), audit logs (`/admin/logs`), and system command center (`/admin/super`)."
            ),
            "followUps": [
                "How do I provision new dentist accounts?",
                "How do I inspect clinic security and activity logs?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if re.search(r"\b(treatment\s*plans?|active\s*treatments?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📈 Viewing & Managing Active Treatment Plans\n\n"
                "Dentists can create and monitor patient treatment plans in **[Clinic Treatments](/clinic/treatments)** or directly from a patient's case file in **[Patient Directory](/clinic/patients)**:\n\n"
                "- Track orthodontic and clinical milestones, stage completion percentages, and practitioner instructions.\n"
                "- Patients automatically see their updated timeline and progress ring on their **[Treatment Progress](/patient/treatment)** page."
            ),
            "followUps": [
                "How do I use the 32-tooth interactive odontogram?",
                "How do I manage patient appointments?",
                "How do I communicate with a dental laboratory?"
            ]
        }

    if re.search(r"\bcommunicat(e|ing)\b.*\blab(oratory)?\b|\bclarifications?\b.*\blab\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 💬 Clinic–Dental Laboratory Communication & Clarifications\n\n"
                "SmileGuard AI streamlines direct prescription messaging between dentists and technicians via **[Clinic Lab Orders](/clinic/lab-orders)** and **[Lab Intake Queue](/lab)**:\n\n"
                "1. **Submit Digital Rx**: Dentists create an order in **[Clinic Lab Orders](/clinic/lab-orders)** with appliance specs, shade, arch/teeth, STL/PLY attachments, and clinical notes.\n"
                "2. **Intake Review & Clarification Loop**: Lab technicians inspect incoming cases on **[Lab Intake Queue](/lab)** and can either **Accept** or trigger `CLARIFICATION_REQUESTED` with specific questions.\n"
                "3. **Dentist Reply & Live Status**: Dentists answer clarification requests and resubmit directly from `/clinic/lab-orders`, while tracking fabrication through **Quality Check**, **Dispatch**, and **Clinic Receipt**."
            ),
            "followUps": [
                "What are the 6 CAD/CAM production stages?",
                "What dental appliances are supported for orders?",
                "How do technicians advance fabrication stages?"
            ]
        }

    if re.search(r"\b(create|submit|place|new)\b.*\blab\s*orders?\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📝 Creating a New Dental Lab Order\n\n"
                "To submit a prosthesis or orthodontic lab prescription in **[Clinic Lab Orders](/clinic/lab-orders)**:\n\n"
                "1. Click **New Lab Order** and select the **Patient**.\n"
                "2. Choose the **Appliance Category** & preset (*Crowns & Bridges*, *Orthodontic Retainers*, *Removable Dentures*, *Repairs*, or *Custom*).\n"
                "3. Pick the **Input Submission Type** (*Digital Scan STL/PLY*, *Physical Impression*, *Stone Model*, or *Prescription Only*), **Material**, **VITA Shade**, and **Arch / Tooth Numbers**.\n"
                "4. Set **Priority**, **Due Date**, and attach radiograph/scan references before submitting to the lab intake queue (`/lab`)."
            ),
            "followUps": [
                "What are the 6 CAD/CAM production stages?",
                "What dental appliances are supported for orders?",
                "Where can dentists check lab order status?"
            ]
        }

    if re.search(r"\b(6|six)\b.*\b(cad[\s/-]*cam|production|fabrication)?\s*stages?\b|\bcad[\s/-]*cam\b.*\bstages?\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### ⚙️ The 6 CAD/CAM Production Stages\n\n"
                "For **Digital CAD/CAM Prosthodontic Cases** (`CROWNS_BRIDGES_DIGITAL`), SmileGuard AI tracks **6 sequential production stages** on **[Lab Production Board](/lab/board)**:\n\n"
                "1. **Case Preparation** — Model prep & digital scan verification\n"
                "2. **CAD Design** — 3D digital margin, pontic, & occlusion design\n"
                "3. **CAM Milling / 3D Printing** — Automated fabrication of Zirconia / e.max\n"
                "4. **Finishing / Staining / Glazing** — Sintering, characterization, & surface glaze\n"
                "5. **Quality Check** — Specification, fit, & workmanship verification gate\n"
                "6. **Ready for Dispatch** — Final packaging for courier delivery to the clinic\n\n"
                "*(Note: SmileGuard also supports service-specific workflows for Orthodontic Retainers, Conventional PFM crowns, Removable Dentures with Clinic Try-In, and Repairs.)*"
            ),
            "followUps": [
                "What dental appliances are supported for orders?",
                "How do technicians advance fabrication stages?",
                "How do I communicate with a dental laboratory?"
            ]
        }

    if re.search(r"\b(supported.*appliances?|appliances?.*supported|what\s+(dental\s+)?appliances?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🦷 Supported Dental Appliances & Case Categories\n\n"
                "SmileGuard AI organizes lab prescriptions across **5 specialized clinical categories** in **[Clinic Lab Orders](/clinic/lab-orders)**:\n\n"
                "- **Crowns & Bridges**: Monolithic Zirconia, IPS e.max lithium disilicate, and Porcelain-Fused-to-Metal (PFM) (*Digital CAD/CAM or Conventional workflow*).\n"
                "- **Orthodontic Retainers & Appliances**: Hawley wire retainers, Clear Essix retainers, Space Maintainers, and Clear Aligners.\n"
                "- **Removable Dentures**: Complete Dentures, Removable Partial Dentures (RPD), and Flexible Valplast Dentures (*supports optional Clinic Wax Try-In*).\n"
                "- **Repairs & Modifications**: Clasp repairs, relines, rebasing, and fractured denture repairs.\n"
                "- **Other / Custom Appliances**: Nightguards, splints, and custom lab prescriptions."
            ),
            "followUps": [
                "What are the 6 CAD/CAM production stages?",
                "How do technicians advance fabrication stages?",
                "How do I create a new lab order?"
            ]
        }

    if re.search(r"\b(technicians?.*advance|advance.*(fabrication|production)?\s*stages?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🔧 How Lab Technicians Advance Fabrication Stages\n\n"
                "Lab technicians manage production end-to-end across **[Lab Intake Queue](/lab)** and **[Lab Production Board](/lab/board)**:\n\n"
                "1. **Intake Review (`/lab`)**: Review `PENDING_REVIEW` cases, verify scan/impression details, and click **Accept Order** (or request clarification).\n"
                "2. **Material Readiness & Start**: Confirm physical impression/model arrival if required, then click **Start Production**.\n"
                "3. **Advance Workflow Stages (`/lab/board`)**: Move each case step-by-step through its workflow stages (recording technician name & notes) and optionally send Denture cases for **Clinic Try-In**.\n"
                "4. **Quality Check Gate & Dispatch**: Complete the 5-point **QC Checklist**, click **Pass QC**, and advance to **Dispatched** so the clinic can confirm receipt."
            ),
            "followUps": [
                "What are the 6 CAD/CAM production stages?",
                "Where can dentists check lab order status?",
                "How do I communicate with a dental laboratory?"
            ]
        }

    if re.search(r"\b(check|view|where)\b.*\blab\b.*\b(orders?|status)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📦 Checking Dental Lab Order Status\n\n"
                "- **For Dentists & Clinic Staff**: Open **[Clinic Lab Orders](/clinic/lab-orders)** to filter orders by status (`PENDING_REVIEW`, `CLARIFICATION_REQUESTED`, `ACCEPTED`, `IN_PRODUCTION`, `QUALITY_CHECK`, `READY_FOR_DISPATCH`, `DISPATCHED`, `COMPLETED`), inspect full stage timelines, reply to clarification requests, and **Confirm Clinic Receipt** upon delivery.\n"
                "- **For Lab Technicians**: Use **[Lab Intake Queue](/lab)** for new requests and **[Lab Production Board](/lab/board)** for active fabrication lanes."
            ),
            "followUps": [
                "How do technicians advance fabrication stages?",
                "What are the 6 CAD/CAM production stages?",
                "How do I create a new lab order?"
            ]
        }

    if re.search(r"\b(lab|laboratory|cad|cam|cad\/cam|lab\s*orders?|appliances?|fabrication|technicians?|crowns?|retainers?|aligners?|dentures?|milling|glazing)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🦷 Dental Laboratory & Production Workflow\n\n"
                "SmileGuard AI connects clinics and dental technicians across **[Clinic Lab Orders](/clinic/lab-orders)**, **[Lab Intake Queue](/lab)**, and **[Lab Production Board](/lab/board)**:\n\n"
                "- **Supported Appliances**: Crowns & Bridges (Zirconia, IPS e.max, PFM), Orthodontic Retainers (Hawley & Clear Essix), Complete/Partial/Flexible Dentures, Nightguards/Splints, and Repairs.\n"
                "- **6-Stage CAD/CAM Production Pipeline**: `Case Preparation` ➔ `CAD Design` ➔ `CAM Milling / 3D Printing` ➔ `Finishing / Staining / Glazing` ➔ `Quality Check` ➔ `Ready for Dispatch`.\n"
                "- **Status Lifecycle**: Dentists submit prescriptions at `/clinic/lab-orders`; lab techs review, confirm materials, advance fabrication stages on `/lab/board`, pass Quality Check, and dispatch for clinic receipt confirmation."
            ),
            "followUps": [
                "How do I create a new lab order?",
                "What are the 6 CAD/CAM production stages?",
                "What dental appliances are supported for orders?",
                "How do technicians advance fabrication stages?"
            ]
        }

    if re.search(r"\b(10173|ra\s*10173|data\s*privacy|onboarding|consents?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🔒 Medical Onboarding & RA 10173 Compliance\n\n"
                "SmileGuard AI enforces compliance with the **Philippine Data Privacy Act of 2012 (Republic Act No. 10173)**:\n\n"
                "- **Explicit Statutory Consent**: Newly registered patients must complete medical history and explicit data-processing consent on `/onboarding` before accessing portal features.\n"
                "- **Strict Access Control**: Cloud Firestore security rules isolate patient records so patients only read their own charts while clinical writes are restricted to authorized practitioners.\n"
                "- **Zero Clinical Caching**: The PWA service worker explicitly bypasses caching for Firestore, Cloudinary radiographs, Auth, and AI endpoints."
            ),
            "followUps": [
                "How do I register a new patient?",
                "How do I inspect clinic security and activity logs?",
                "How do I use the 32-tooth interactive odontogram?"
            ]
        }

    if re.search(r"\brecord(ing)?\b.*\b(findings?|surfaces?)\b|\btooth\s+surfaces?\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🦷 Recording Findings on Tooth Surfaces\n\n"
                "In any patient case file under **[Patient Directory](/clinic/patients)**:\n\n"
                "1. **Select a Tooth**: Click any tooth on the 32-tooth adult chart (Universal or FDI notation).\n"
                "2. **Choose Surfaces**: Mark findings individually on the **5 anatomical surfaces** — **Mesial (M)**, **Distal (D)**, **Occlusal / Incisal (O)**, **Buccal (B)**, and **Lingual (L)**.\n"
                "3. **Assign Condition & Save**: Select the surface status (*Caries*, *Filled*, *Crown*, *Sound*, etc.), attach optional clinical notes, and save directly to the patient's chart."
            ),
            "followUps": [
                "How do I use the 32-tooth interactive odontogram?",
                "How do I register a new patient?",
                "Where can I see active treatment plans?"
            ]
        }

    if re.search(r"\b(odontograms?|32-tooth|mesial|distal|occlusal|buccal|lingual)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🦷 Using the 32-Tooth Interactive Adult Odontogram\n\n"
                "Inside any patient's case file via **[Patient Directory](/clinic/patients)**:\n\n"
                "1. **Select a Tooth**: Click any of the 32 adult teeth (supports Universal and FDI numbering).\n"
                "2. **Inspect 5 Surfaces**: Toggle findings individually on **Mesial**, **Distal**, **Occlusal/Incisal**, **Buccal**, and **Lingual** surfaces.\n"
                "3. **Assign Clinical Status**: Choose *Sound*, *Caries*, *Filled*, *Crown*, *Bridge*, *Missing*, *Endodontic Treated*, or *Extraction Indicated*.\n"
                "4. **Save to Chart**: Changes persist immediately to Firestore with clinician attribution."
            ),
            "followUps": [
                "How do I record findings on tooth surfaces?",
                "How do I register a new patient?",
                "How does medical onboarding comply with RA 10173?"
            ]
        }

    if normalized_role == "GUEST" and re.search(r"\bmy\s+(dental\s+)?records?\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📂 Your Dental Records & Radiographs\n\n"
                "Once signed in as a patient, you can inspect your shared dental X-rays and clinical history in **[Dental Records](/patient/records)** with interactive zoom, pan, contrast, and invert tools."
            ),
            "followUps": [
                "Where can I see my scheduled appointments?",
                "How do I book an appointment?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if re.search(r"\b(patients?|register|charts?|records?|director(y|ies))\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📋 Patient Registration & Clinic Directory\n\n"
                "1. **Patient Directory ([Go to Patient Directory](/clinic/patients))**:\n"
                "   - Search registered patients, open full case files, inspect medical histories, view uploaded radiographs, and chart on the **32-tooth interactive odontogram**.\n\n"
                "2. **Registering a New Patient**:\n"
                "   - Patients self-register via **Sign Up** (`/signup`, strictly provisioned as `PATIENT`) and complete their medical history & **RA 10173** privacy consent on `/onboarding`, making their profile immediately searchable in the clinic directory."
            ),
            "followUps": [
                "How do I use the 32-tooth interactive odontogram?",
                "How does medical onboarding comply with RA 10173?",
                "How do I manage patient appointments?"
            ]
        }

    if normalized_role == "GUEST" and re.search(r"\b(brush(ing)?|streaks?|habits?|gardy\s*mascot|timers?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🪥 Daily Brushing Streaks & Gardy Mascot\n\n"
                "In the **[Patient Portal](/patient)**, patients log morning (AM) and evening (PM) brushing sessions using an interactive **2-minute quadrant timer** and build streak milestone badges alongside **Gardy**!"
            ),
            "followUps": [
                "How do I book an appointment?",
                "Where can I see my scheduled appointments?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if normalized_role == "GUEST" and re.search(r"\b(toothaches?|tooth\s*pain|teeth\s*hurt|sensitive\s*tooth|sensitive\s*teeth)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🦷 Relief & Care for Toothache or Tooth Sensitivity\n\n"
                "Rinse gently with warm salt water, apply a cold compress externally for 15 minutes, avoid very hot/cold/sweet triggers, and never press aspirin directly against the gums. Since a toothache requires clinical inspection, please **[Book an Appointment](/patient/book)** with a SmileGuard dentist."
            ),
            "followUps": [
                "How do I book an appointment?",
                "Where can I see my scheduled appointments?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if normalized_role == "GUEST" and re.search(r"\b(orthodontics?|treatment.*progress|aligners?|braces?)\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 📈 Orthodontic & Treatment Progress\n\n"
                "Patients track active orthodontic milestones, completion percentage, and dentist updates on **[Treatment Progress](/patient/treatment)** inside the Patient Portal."
            ),
            "followUps": [
                "Where can I see my scheduled appointments?",
                "How do I book an appointment?",
                "What features are available in SmileGuard AI?"
            ]
        }

    if re.search(r"\b(features?|capabilities|overview|system\s*features?|what\s+(is|can)\s+(smileguard|this|you))\b", msg):
        return {
            "content": (
                f"{emergency_prefix}### 🌟 SmileGuard AI System Capabilities\n\n"
                "SmileGuard AI is an integrated dental clinic management and clinical decision support platform:\n\n"
                "- 🏥 **Clinical Portal**: Live appointment triage ([Queue](/clinic/queue)), patient case files ([Directory](/clinic/patients)), 32-tooth interactive odontogram, and treatment plans ([Treatments](/clinic/treatments)).\n"
                "- 🔬 **AI Diagnostic Workstation**: Two-stage **`EfficientNetB0`** OPG gatekeeper (`0.60` threshold) + 6-class pathology classifier + pre-softmax Grad-CAM ([Workstation](/clinic/ai-workstation)).\n"
                "- 🦷 **Dental Laboratory Pipeline**: Prescription intake ([Clinic Lab Orders](/clinic/lab-orders)) and service-specific production board ([Lab Board](/lab/board)).\n"
                "- 📱 **Patient Portal**: 3-step booking ([Book](/patient/book)), appointment management ([My Appointments](/patient/appointments)), treatment timeline ([Treatment](/patient/treatment)), records ([Records](/patient/records)), and brushing streaks.\n"
                "- 🛡️ **Admin & Privacy**: Role provisioning ([Users](/admin/users)), immutable audit trail ([Logs](/admin/logs)), and **RA 10173** compliance."
            ),
            "followUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "How do I communicate with a dental laboratory?",
                "What user roles are supported in SmileGuard AI?"
            ]
        }

    if is_greeting_only or is_thanks_only:
        return {
            "content": (
                f"{emergency_prefix}You're welcome! Let me know if you need help with patient appointments, AI radiograph diagnostics, lab orders, or clinic workflows."
                if is_thanks_only
                else f"{emergency_prefix}Hello! I'm **Gardy Assistant**, your SmileGuard AI clinical and clinic-workflow assistant.\n\nHow can I assist you with **[Appointments Queue](/clinic/queue)**, **[AI Workstation](/clinic/ai-workstation)**, **[Patient Directory](/clinic/patients)**, or **[Lab Orders](/clinic/lab-orders)** today?"
            ),
            "followUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "How do I communicate with a dental laboratory?"
            ]
        }

    return {
        "content": (
            f"{emergency_prefix}Hello! I'm **Gardy Assistant**. I can help you navigate SmileGuard AI, understand dental conditions, and assist with your clinic workflows:\n\n"
            "- **Appointment Management**: Triage queue stages and conflict-free booking ([Appointments Queue](/clinic/queue)).\n"
            "- **AI Radiograph Diagnostics**: Two-stage EfficientNetB0 OPG validator and pathology analysis ([AI Workstation](/clinic/ai-workstation)).\n"
            "- **Patient Records & Odontogram**: 32-tooth interactive anatomical charting ([Patient Directory](/clinic/patients)).\n"
            "- **Dental Laboratory**: Service-specific appliance intake and fabrication board ([Lab Orders](/clinic/lab-orders)).\n\n"
            "How can I help you today?"
        ),
        "followUps": [
            "How do I manage patient appointments?",
            "What does the AI dental X-ray diagnosis mean?",
            "How do I communicate with a dental laboratory?"
        ]
    }


def call_gemini_api(
    messages: List[Dict[str, str]],
    role: str,
    api_key: str,
    model_name: str = "gemini-1.5-flash",
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Executes a structured generative request to the Google Gemini REST API.
    """
    import requests

    is_patient_user = _is_patient_context(role, context)
    system_instruction = (
        f"{SMILEGUARD_SYSTEM_PROMPT}\n\n"
        f"--- CURRENT CONTEXT ---\n"
        f"{ROLE_CONTEXT_INSTRUCTIONS.get(role.upper(), ROLE_CONTEXT_INSTRUCTIONS['GUEST'])}\n\n"
        f"--- SYSTEM KNOWLEDGE BASE ---\n"
        f"{SMILEGUARD_APP_KNOWLEDGE}"
    )

    # Format OpenAI-style history into Gemini contents format
    gemini_contents = []
    for m in messages[-8:]: # keep last 8 turns for token efficiency
        r = m.get("role", "user")
        text = m.get("content", "")
        gemini_role = "user" if r in ["user", "system"] else "model"
        gemini_contents.append({
            "role": gemini_role,
            "parts": [{"text": text}]
        })

    payload = {
        "contents": gemini_contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 800,
            "topP": 0.8
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    
    if not resp.ok:
        raise RuntimeError(f"Gemini API returned status {resp.status_code}: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError("No candidate generated by Gemini API.")

    first_candidate = candidates[0]
    parts = first_candidate.get("content", {}).get("parts", [])
    text_parts = [p.get("text", "") for p in parts]
    reply_text = "\n".join(text_parts).strip()

    # Determine role-appropriate dynamic follow-ups
    if is_patient_user:
        follow_ups = [
            "Where can I see my scheduled appointments?",
            "How do I book an appointment?",
            "How do daily brushing streaks work?"
        ]
        if "caries" in reply_text.lower() or "x-ray" in reply_text.lower():
            follow_ups = [
                "What does the AI dental X-ray diagnosis mean?",
                "Where can I see my dental records?",
                "Where can I see my scheduled appointments?"
            ]
    else:
        follow_ups = [
            "How do I manage patient appointments?",
            "What does the AI dental X-ray diagnosis mean?",
            "Where can I view CAD/CAM lab orders?"
        ]
        if "caries" in reply_text.lower() or "x-ray" in reply_text.lower():
            follow_ups = [
                "How does the two-stage CNN validator work?",
                "What is pre-softmax Grad-CAM explainability?",
                "Where do I find the AI Diagnostic Workstation?"
            ]

    return {
        "content": reply_text,
        "followUps": follow_ups,
        "model": model_name
    }


def process_chat_message(
    messages: List[Dict[str, str]],
    role: str = "GUEST",
    context: Optional[Dict[str, Any]] = None,
    client_id: str = "default_user"
) -> Dict[str, Any]:
    """
    Main entrypoint for processing user messages.
    Handles rate limiting, out-of-scope filtering, external AI call, or smart rule engine.
    """
    if not check_rate_limit(client_id):
        return {
            "success": False,
            "error": "RATE_LIMIT_EXCEEDED",
            "message": {
                "role": "assistant",
                "content": "⚠️ You are sending messages too quickly. Please wait a moment before sending another message.",
                "timestamp": int(time.time() * 1000)
            },
            "suggestedFollowUps": []
        }

    if not messages:
        return {
            "success": False,
            "error": "EMPTY_MESSAGES",
            "message": {
                "role": "assistant",
                "content": "Please enter a question or select one of the suggested prompts.",
                "timestamp": int(time.time() * 1000)
            },
            "suggestedFollowUps": []
        }

    latest_msg = messages[-1].get("content", "").strip()
    is_patient_user = _is_patient_context(role, context)

    # Enforce reasonable message length limit (1000 characters)
    if len(latest_msg) > 1000:
        return {
            "success": False,
            "error": "MESSAGE_TOO_LONG",
            "message": {
                "role": "assistant",
                "content": "Your message is too long (maximum 1,000 characters). Please condense your question.",
                "timestamp": int(time.time() * 1000)
            },
            "suggestedFollowUps": []
        }

    # Strict out-of-scope redirection
    if is_out_of_scope(latest_msg):
        deflection = (
            "I am **Gardy Assistant**, specifically designed for dental clinic operations, "
            "dental education, and SmileGuard AI workflows. I cannot assist with general topics "
            "outside of dental care and clinic management.\n\n"
            "How can I help you with your dental practice, appointment queue, patient records, or AI X-ray diagnostics today?"
        )
        return {
            "success": True,
            "message": {
                "role": "assistant",
                "content": deflection,
                "timestamp": int(time.time() * 1000)
            },
            "suggestedFollowUps": (
                [
                    "Where can I see my scheduled appointments?",
                    "How do I book an appointment?",
                    "How do daily brushing streaks work?"
                ]
                if is_patient_user
                else [
                    "How do I manage patient appointments?",
                    "What does the AI dental X-ray diagnosis mean?",
                    "What features are available in SmileGuard AI?"
                ]
            ),
            "disclaimer": "AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."
        }

    # Try external LLM API if key is present in environment
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    ai_model = os.environ.get("AI_CHAT_MODEL", os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")).strip()

    if gemini_key:
        try:
            res = call_gemini_api(messages, role=role, api_key=gemini_key, model_name=ai_model, context=context)
            return {
                "success": True,
                "message": {
                    "role": "assistant",
                    "content": res["content"],
                    "timestamp": int(time.time() * 1000)
                },
                "suggestedFollowUps": res.get("followUps", []),
                "model": res.get("model", ai_model),
                "disclaimer": "AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."
            }
        except Exception as e:
            print(f"[!] Warning: Gemini API call failed ({e}). Falling back to SmileGuard Rule Engine.")

    # Fallback: Smart Clinical Decision Support Rule Engine
    res = generate_rule_based_response(latest_msg, role=role, context=context)
    return {
        "success": True,
        "message": {
            "role": "assistant",
            "content": res["content"],
            "timestamp": int(time.time() * 1000)
        },
        "suggestedFollowUps": res.get("followUps", []),
        "model": "smileguard-clinical-engine-v2",
        "disclaimer": "AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."
    }
