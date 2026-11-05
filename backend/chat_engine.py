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
        "- Digital CAD/CAM lab orders queue (/lab/orders).\n"
        "- Tracking the 6-stage production pipeline: 1. Received -> 2. Design (CAD) -> 3. Milling (CAM) -> 4. Glazing/Baking -> 5. QA/Inspection -> 6. Dispatched.\n"
        "- Appliance prescriptions (Zirconia crowns, e.max veneers, Hawley retainers, orthodontic aligners, bridges).\n"
        "- Communicating fabrication progress back to attending dentists."
    ),
    "PATIENT": (
        "USER ROLE: PATIENT.\n"
        "Prioritize:\n"
        "- 3-step dynamic appointment booking wizard (/patient/book: Procedure -> Dentist -> Date & Time Slot).\n"
        "- Viewing upcoming and past appointments (/patient/appointments).\n"
        "- Orthodontic alignment progress timeline and tray changeover milestones (/patient/treatment).\n"
        "- Viewing personal dental records and imaging gallery (/patient/records).\n"
        "- Gamified morning and night brushing streak tracker with Gardy mascot (/patient/brush-streak).\n"
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
  * Stage 1: MobileNetV2 Binary Validator. Acts as a gatekeeper to verify if the radiograph is an authentic Dental OPG. Non-OPG images (selfies, documents, objects) are rejected with status 422 to prevent false clinical classifications.
  * Stage 2: EfficientNetB0 Pathology Classifier. Evaluates verified dental OPGs for Dental Caries, Impacted Teeth, Periapical Lesions / Infection, Periodontal Bone Loss, BDC-BDR (badly decayed crown / retained root), and Healthy Teeth.
  * Explainability: Pre-softmax Class Activation Mapping (Grad-CAM) targeting layer 'top_activation', blended with OpenCV Jet colormap.
  * Policy: Zero fabrication of AI predictions.
- 32-Tooth Interactive Adult Odontogram (/clinic/patients/:id): Full FDI/Universal charting with 5 surfaces per tooth (Mesial, Distal, Occlusal, Buccal, Lingual). Supported statuses: Sound, Caries, Filled, Crown, Bridge, Missing, Endodontic Treated, Extraction Indicated.
- Triage Appointments Queue (/clinic/queue): Real-time queue for chairside status updates: PENDING -> CONFIRMED -> IN_CHAIR -> COMPLETED (or CANCELLED/REJECTED with reason). Enforces conflict-free time slots per dentist.
- CAD/CAM Lab Orders Board (/clinic/lab-orders & /lab/orders): 6-stage manufacturing lifecycle: Received -> CAD -> CAM -> Glazing -> QA -> Dispatched.
- Patient Portal (/patient): 3-step booking wizard, orthodontic timeline, brushing streak habits (morning & night check-ins with Gardy mascot), radiology records gallery.
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

def generate_rule_based_response(user_msg: str, role: str) -> Dict[str, Any]:
    """
    Intelligent built-in SmileGuard dental clinical assistant engine.
    Used when external API keys are not provided or as an immediate, reliable fallback.
    """
    msg = user_msg.lower().strip()

    # Out of scope deflection
    if is_out_of_scope(msg):
        return {
            "content": (
                "I am **Gardy Assistant**, specifically designed to assist with dental clinic management, "
                "dental education, and SmileGuard AI workflows. I cannot assist with topics outside of dental care "
                "and clinic operations.\n\n"
                "How can I help you with your dental practice, appointment queue, patient records, or AI X-ray diagnostics today?"
            ),
            "followUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "What features are available in SmileGuard AI?"
            ]
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
            "followUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "Where can I find the clinic directory?"
            ]
        }

    # Workstation findings trigger
    if any(k in msg for k in ["clinical significance", "radiographical indicators", "differential considerations"]):
        quick_links = (
            "   - Quick Links: [Book Appointment](/patient/book)\n\n"
            if role == "PATIENT"
            else "   - Quick Links: [Open AI Workstation](/clinic/ai-workstation) • [View Patient Directory](/clinic/patients)\n\n"
        )
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
            f"{quick_links}"
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

    # Appointment management
    if any(k in msg for k in ["appointment", "booking", "schedule", "queue", "triage"]):
        if role in ["DENTIST", "ADMIN", "SUPERADMIN", "RECEPTIONIST"]:
            content = (
                f"{emergency_prefix}### 📅 Managing Patient Appointments in SmileGuard AI\n\n"
                "1. **Chairside Triage Queue ([View Appointments Queue](/clinic/queue))**:\n"
                "   - Review incoming appointment requests organized in real time.\n"
                "   - Progression stages: `PENDING` ➔ `CONFIRMED` ➔ `IN_CHAIR` ➔ `COMPLETED`.\n"
                "   - If declining a booking, select `REJECTED` or `CANCELLED` and enter a mandatory clinical reason.\n\n"
                "2. **Conflict Prevention**:\n"
                "   - SmileGuard AI automatically validates time slots to prevent double-booking for the same dentist.\n\n"
                "3. **Chair Status Tracking**:\n"
                "   - Move patients to `IN_CHAIR` when treatment begins, which updates the clinic overview dashboard and patient notifications."
            )
        else:
            content = (
                f"{emergency_prefix}### 📅 Booking an Appointment as a Patient\n\n"
                "You can book an appointment in 3 easy steps through the **Book Appointment** tab ([Book Appointment](/patient/book)):\n"
                "1. **Select Procedure**: Choose your treatment (Consultation, Scaling, Orthodontic Adjustment, Root Canal, Radiograph).\n"
                "2. **Choose Dentist**: Pick from registered practitioners in our clinic directory.\n"
                "3. **Select Date & Time**: Pick an available slot. Overlapping slots are automatically blocked to prevent scheduling conflicts."
            )
        return {
            "content": content,
            "followUps": [
                "What does the AI dental X-ray diagnosis mean?",
                "How do I register a new patient?",
                "Where can I see active treatment plans?"
            ]
        }

        action_line = (
            "   - Note: Radiographs are evaluated by your dental team using SmileGuard AI diagnostic tools during your consultation.\n\n"
            if role == "PATIENT"
            else "   - Action: [Open AI Workstation](/clinic/ai-workstation)\n\n"
        )
        content = (
            f"{emergency_prefix}### 🔬 SmileGuard Two-Stage CNN Diagnostic Pipeline\n\n"
            "SmileGuard AI features a deep learning computer vision pipeline designed for dental panoramic radiographs (OPGs):\n\n"
            "1. **Stage 1: OPG Gatekeeper Validator (MobileNetV2)**\n"
            "   - Evaluates incoming images to verify they are authentic dental panoramic radiographs.\n"
            "   - Non-dental images (photos, documents, selfies) are immediately rejected with status `422 INVALID_XRAY` to prevent false positive classifications.\n\n"
            "2. **Stage 2: Pathology Classifier (EfficientNetB0)**\n"
            "   - Evaluates verified radiographs across clinical categories:\n"
            "     * **Dental Caries**: Radiolucent enamel/dentin demineralization from bacterial breakdown.\n"
            "     * **Impacted Teeth**: Abnormal angulation or mechanical obstruction preventing normal third molar/canine eruption.\n"
            "     * **Infection / Periapical Lesions**: Periapical radiolucencies at the root apex indicative of apical periodontitis or abscess.\n"
            "     * **Periodontal Bone Loss / BDC-BDR / Healthy Teeth**: Alveolar crest resorption or retained roots.\n\n"
            "3. **Explainability with Pre-Softmax Grad-CAM**:\n"
            "   - Generates high-resolution heatmaps targeting layer `top_activation` without softmax saturation, highlighting anatomical regions influencing prediction.\n"
            f"{action_line}"
            "> ⚠️ **Clinical Decision Support Disclaimer**:\n"
            "> *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*"
        )
        return {
            "content": content,
            "followUps": [
                "How does the Stage-1 validator reject non-OPG images?",
                "How do I use the AI Diagnostic Workstation?",
                "What is Grad-CAM explainability?"
            ]
        }

    # Dental Laboratory & CAD/CAM
    if any(k in msg for k in ["lab", "laboratory", "cad", "cam", "order", "crown", "retainer", "aligner"]):
        content = (
            "### 🦷 Dental Laboratory & CAD/CAM Management\n\n"
            "SmileGuard AI connects clinics and dental laboratories via a dedicated production workflow (`/clinic/lab-orders` & `/lab/orders`):\n\n"
            "- **Supported Appliances**: Zirconia crowns, e.max veneers, Hawley retainers, orthodontic aligners, and bridges.\n"
            "- **6-Stage Production Pipeline**:\n"
            "  1. `Received`: Prescription and digital impression/model received.\n"
            "  2. `Design (CAD)`: Digital 3D modeling and margin design.\n"
            "  3. `Milling (CAM)`: Machine milling or 3D printing of the appliance.\n"
            "  4. `Glazing/Baking`: Sintering, crystallization, and staining.\n"
            "  5. `QA/Inspection`: Margin integrity, occlusion, and fit verification.\n"
            "  6. `Dispatched`: Packed and shipped to clinic for chairside seating.\n\n"
            "Dentists can monitor order statuses in real time, and lab technicians can advance stages with timestamps."
        )
        return {
            "content": content,
            "followUps": [
                "How do I create a new lab order?",
                "What appliances are supported?",
                "Where can dentists check lab order status?"
            ]
        }

    # Patient Registration & Odontogram
    if any(k in msg for k in ["patient", "register", "odontogram", "chart", "record", "directory"]):
        content = (
            "### 📋 Patient Management & 32-Tooth Odontogram\n\n"
            "1. **Patient Directory (`/clinic/patients`)**:\n"
            "   - Search registered patients, inspect medical histories, and review compliance records.\n"
            "   - Compliant with Republic Act No. 10173 (Philippine Data Privacy Act).\n\n"
            "2. **32-Tooth Interactive Adult Odontogram**:\n"
            "   - Anatomical charting supporting Universal and FDI numbering notations.\n"
            "   - Interactive 5-surface inspection: **Mesial**, **Distal**, **Occlusal/Incisal**, **Buccal**, and **Lingual**.\n"
            "   - Clinical statuses: *Sound*, *Caries*, *Filled*, *Crown*, *Bridge*, *Missing*, *Endodontic Treated*, and *Extraction Indicated*.\n\n"
            "3. **Case Files**:\n"
            "   - Full chronological clinical notes, treatment history, and radiographic imaging gallery."
        )
        return {
            "content": content,
            "followUps": [
                "How do I record findings on the 32-tooth odontogram?",
                "How does medical onboarding comply with RA 10173?",
                "How do I manage patient appointments?"
            ]
        }

    # Features Overview
    if any(k in msg for k in ["feature", "smileguard", "system", "what can you do", "help", "overview"]):
        content = (
            "### 🌟 SmileGuard AI System Capabilities\n\n"
            "SmileGuard AI is an integrated dental practice management and clinical decision support system:\n\n"
            "- 🏥 **Clinical Portal**: Real-time appointment triage, digital patient case files, 32-tooth interactive odontogram, treatment planning.\n"
            "- 🔬 **Two-Stage AI Diagnostic Workstation**: OPG radiograph gatekeeper validator + EfficientNetB0 pathology classifier with pre-softmax Grad-CAM.\n"
            "- 🦷 **Digital CAD/CAM Lab Pipeline**: 6-stage appliance production tracking (Received to Dispatched).\n"
            "- 📱 **Patient Engagement**: 3-step appointment booking, orthodontic timeline, daily brushing streak habits with Gardy mascot.\n"
            "- 🛡️ **Role-Based Security**: Authoritative Firebase authentication, role provisioning (Dentist, Lab Tech, Admin, Patient), and audit logging.\n\n"
            "What specific workflow or feature would you like to explore?"
        )
        return {
            "content": content,
            "followUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "How do I communicate with a dental laboratory?"
            ]
        }

    # Default fallback
    if role == "PATIENT":
        return {
            "content": (
                "Hello! I'm **Gardy Assistant**. I'm here to assist you with your dental health questions, appointments, and care guidance. "
                "You can ask me about:\n\n"
                "- **Appointments**: Booking and managing your clinic visits.\n"
                "- **Oral Hygiene**: Daily brushing habits, teeth care, and cavity prevention.\n"
                "- **Dental Treatments**: Common dental procedures, cleanings, and orthodontics.\n\n"
                "Quick Links: [Book Appointment](/patient/book)\n\n"
                "How can I help you today?"
            ),
            "followUps": [
                "How do I book an appointment?",
                "How do daily brushing streaks work?",
                "What do I do if I have a toothache?"
            ]
        }

    return {
        "content": (
            "I'm here to assist you with SmileGuard AI clinic operations, dental education, and workflow navigation. "
            "You can ask me about:\n\n"
            "- **Appointment Management**: Triage queue stages, scheduling, conflict prevention.\n"
            "- **AI Diagnostics**: 2-stage CNN OPG validator, pathology classification (Caries, Impacted Teeth, Infection), Grad-CAM heatmaps.\n"
            "- **Patient Records**: 32-tooth odontogram, treatment plans, case files.\n"
            "- **Dental Laboratory**: CAD/CAM orders and production stages.\n"
            "- **Role Guidelines**: Guidance tailored for Dentists, Receptionists, Admins, and Patients.\n\n"
            "What would you like assistance with?"
        ),
        "followUps": [
            "How do I manage patient appointments?",
            "What does the AI dental X-ray diagnosis mean?",
            "What features are available in SmileGuard AI?"
        ]
    }


def call_gemini_api(
    messages: List[Dict[str, str]],
    role: str,
    api_key: str,
    model_name: str = "gemini-1.5-flash"
) -> Dict[str, Any]:
    """
    Executes a structured generative request to the Google Gemini REST API.
    """
    import requests

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

    # Determine dynamic follow-ups
    follow_ups = [
        "How do I manage patient appointments?",
        "What does the AI dental X-ray diagnosis mean?",
        "Where can I view CAD/CAM lab orders?"
    ]
    if "caries" in reply_text.lower() or "x-ray" in reply_text.lower():
        follow_ups = [
            "How does the two-stage CNN validator work?",
            "What is pre-softmax Grad-CAM?",
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
            "suggestedFollowUps": [
                "How do I manage patient appointments?",
                "What does the AI dental X-ray diagnosis mean?",
                "What features are available in SmileGuard AI?"
            ],
            "disclaimer": "AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."
        }

    # Try external LLM API if key is present in environment
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    ai_model = os.environ.get("AI_CHAT_MODEL", os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")).strip()

    if gemini_key:
        try:
            res = call_gemini_api(messages, role=role, api_key=gemini_key, model_name=ai_model)
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
    res = generate_rule_based_response(latest_msg, role=role)
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
