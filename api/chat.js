/**
 * SmileGuard AI - Vercel Serverless Function for Gardy Assistant
 * Endpoint: POST /api/chat
 * Provides real-time AI conversational support using Google Gemini 1.5 Flash
 * with fallback to the SmileGuard clinical dental knowledge engine.
 */

const SMILEGUARD_SYSTEM_PROMPT = `You are Gardy Assistant, an AI-powered support assistant integrated into SmileGuard AI, an AI-assisted dental clinic management and clinical decision support system.

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
"AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional."`;

const ROLE_INSTRUCTIONS = {
  DENTIST: `USER ROLE: DENTIST / SPECIALIST.
Prioritize:
- Dental X-ray AI interpretation guidance and understanding the 2-stage CNN pipeline.
- Explaining predicted dental conditions (Dental Caries, Impacted Teeth, Infection, Periodontal Bone Loss).
- Patient case records and the 32-tooth interactive adult odontogram (Mesial, Distal, Occlusal, Buccal, Lingual).
- Chairside appointments queue triage (/clinic/queue: PENDING -> CONFIRMED -> IN_CHAIR -> COMPLETED).
- Clinical workflow guidance and treatment plans.
- Dental laboratory CAD/CAM requests and appliance fabrication tracking (/clinic/lab-orders).`,
  RECEPTIONIST: `USER ROLE: CLINIC RECEPTIONIST / CLINIC STAFF.
Prioritize:
- Patient registration and medical onboarding under RA 10173.
- Appointment scheduling, queue management, and conflict prevention (/clinic/queue).
- Appointment status checks (Pending, Confirmed, In Chair, Completed, Cancelled).
- Patient contact details and directory search (/clinic/patients).
- Front-desk scheduling and daily clinic queue workflows.`,
  ADMIN: `USER ROLE: CLINIC ADMINISTRATOR / SUPERADMIN.
Prioritize:
- Staff account provisioning and user role management (/admin/users).
- Promoting or activating Dentist, Lab Tech, or Admin accounts.
- Clinic operations oversight and practice management settings.
- Reviewing immutable security and clinical audit logs (/admin/logs).`,
  SUPERADMIN: `USER ROLE: SUPERADMINISTRATOR.
Prioritize full system administration, staff registry, security logs, and database controls.`,
  LAB_TECH: `USER ROLE: DENTAL LABORATORY TECHNICIAN.
Prioritize:
- Digital CAD/CAM lab orders queue (/lab/orders).
- Tracking the 6-stage production pipeline: Received -> CAD -> CAM -> Glazing -> QA -> Dispatched.
- Appliance prescriptions (Zirconia crowns, e.max veneers, Hawley retainers, aligners).`,
  PATIENT: `USER ROLE: PATIENT.
Prioritize:
- 3-step appointment booking wizard (/patient/book).
- Upcoming and past appointments (/patient/appointments).
- Orthodontic alignment progress timeline and tray changes (/patient/treatment).
- Viewing personal dental records and imaging gallery (/patient/records).
- Gamified morning and night brushing streak tracker with Gardy mascot.
- Preventative oral hygiene and patient education in simple terms.
Remind patients that assistant answers cannot replace an in-person dental consultation.`
};

const SMILEGUARD_KNOWLEDGE = `
SmileGuard AI Platform Reference:
- AI Diagnostic Workstation (/clinic/ai-workstation): Real Two-Stage CNN pipeline.
  * Stage 1: MobileNetV2 Binary Validator. Pre-screens radiographs. Non-OPG images (photos, documents, selfies) are rejected with status 422 to prevent false clinical positives.
  * Stage 2: EfficientNetB0 Pathology Classifier. Evaluates verified dental OPGs for Dental Caries, Impacted Teeth, Periapical Lesions / Infection, Periodontal Bone Loss, BDC-BDR, and Healthy Teeth.
  * Explainability: Pre-softmax Class Activation Mapping (Grad-CAM) on layer 'top_activation' blended with Jet colormap.
- 32-Tooth Interactive Adult Odontogram (/clinic/patients/:id): Full FDI/Universal charting with 5 surfaces per tooth (Mesial, Distal, Occlusal, Buccal, Lingual).
- Triage Appointments Queue (/clinic/queue): Real-time queue for chairside status updates: PENDING -> CONFIRMED -> IN_CHAIR -> COMPLETED. Enforces conflict-free time slots per dentist.
- CAD/CAM Lab Orders Board (/clinic/lab-orders & /lab/orders): 6-stage manufacturing lifecycle: Received -> CAD -> CAM -> Glazing -> QA -> Dispatched.
- Patient Portal (/patient): 3-step booking wizard, orthodontic timeline, brushing streak habits with Gardy mascot.
`;

const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReq = 25;
  const history = rateLimitMap.get(ip) || [];
  const recent = history.filter((t) => now - t < windowMs);
  if (recent.length >= maxReq) {
    rateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

const OUT_OF_SCOPE_REGEX = /\b(write a poem|write code|python script|solve this math|who won the world cup|recipe for|president of|stock price|weather in|crypto|bitcoin)\b/i;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    return res.status(200).json({
      status: 'ready',
      assistant: 'Gardy Assistant',
      version: '2.0.0',
      mode: geminiKey ? 'Gemini 1.5 Flash (Generative)' : 'SmileGuard Clinical Decision Engine',
      model: process.env.AI_CHAT_MODEL || 'gemini-1.5-flash',
      scope: 'Dental practice management and clinical decision support'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: {
        role: 'assistant',
        content: '⚠️ You are sending messages too quickly. Please wait a moment before sending another message.',
        timestamp: Date.now()
      }
    });
  }

  try {
    const { messages = [], role = 'GUEST', context } = req.body || {};
    if (!messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    const latestMessage = (messages[messages.length - 1]?.content || '').trim();
    if (latestMessage.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'MESSAGE_TOO_LONG',
        message: {
          role: 'assistant',
          content: 'Your message exceeds the 1,000 character limit. Please shorten your question.',
          timestamp: Date.now()
        }
      });
    }

    // Strict Out-of-Scope Deflection
    if (OUT_OF_SCOPE_REGEX.test(latestMessage)) {
      return res.status(200).json({
        success: true,
        message: {
          role: 'assistant',
          content: `I am **Gardy Assistant**, specifically designed for dental clinic operations, dental education, and SmileGuard AI workflows. I cannot assist with general topics outside of dental care and clinic management.\n\nHow can I help you with your dental practice, appointment queue, patient records, or AI X-ray diagnostics today?`,
          timestamp: Date.now()
        },
        suggestedFollowUps: [
          'How do I manage patient appointments?',
          'What does the AI dental X-ray diagnosis mean?',
          'What features are available in SmileGuard AI?'
        ],
        disclaimer: 'AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.'
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.AI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (geminiKey) {
      try {
        const rolePrompt = ROLE_INSTRUCTIONS[role.toUpperCase()] || ROLE_INSTRUCTIONS['GUEST'];
        const fullSystemInstruction = `${SMILEGUARD_SYSTEM_PROMPT}\n\n--- CURRENT CONTEXT ---\n${rolePrompt}\n\n--- KNOWLEDGE BASE ---\n${SMILEGUARD_KNOWLEDGE}`;

        const geminiContents = messages.slice(-8).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const geminiPayload = {
          contents: geminiContents,
          systemInstruction: {
            parts: [{ text: fullSystemInstruction }]
          },
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 800,
            topP: 0.8
          }
        };

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            let followUps = [
              'How do I manage patient appointments?',
              'What does the AI dental X-ray diagnosis mean?',
              'Where can I view CAD/CAM lab orders?'
            ];
            if (/caries|x-ray|xray|opg/i.test(reply)) {
              followUps = [
                'How does the two-stage CNN validator work?',
                'What is pre-softmax Grad-CAM?',
                'Where do I find the AI Diagnostic Workstation?'
              ];
            }
            return res.status(200).json({
              success: true,
              message: {
                role: 'assistant',
                content: reply.trim(),
                timestamp: Date.now()
              },
              suggestedFollowUps: followUps,
              model: modelName,
              disclaimer: 'AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.'
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to rule engine:', geminiErr);
      }
    }

    // Built-in SmileGuard Rule Engine Fallback
    const msg = latestMessage.toLowerCase();
    let reply = '';
    let followUps = [
      'How do I manage patient appointments?',
      'What does the AI dental X-ray diagnosis mean?',
      'What features are available in SmileGuard AI?'
    ];

    // Check emergency advisory
    const isEmergency = /\b(severe swelling|facial swelling|swollen face|face swollen|difficulty breathing|trouble breathing|difficulty swallowing|uncontrolled bleeding|heavy bleeding|knocked out tooth|avulsed tooth|severe trauma)\b/i.test(msg);
    let emergencyPrefix = '';
    if (isEmergency) {
      return res.status(200).json({
        success: true,
        message: {
          role: 'assistant',
          content: `> 🚨 **URGENT DENTAL TRIAGE ADVISORY**:\n> The symptoms described may represent an acute dental emergency (e.g. cellulitis, fascial space infection, airway obstruction, or uncontrolled bleeding). Please visit your nearest hospital emergency department or contact emergency dental services immediately.\n\n### 🚨 Immediate Dental Triage Guidance\n\n1. **Airway & Facial Space Infection**: Progressive swelling spreading toward the eye, submandibular space, or floor of the mouth can compromise the airway. Seek emergency hospital care immediately.\n\n2. **Knocked-Out (Avulsed) Permanent Tooth**: Keep the tooth moist in cold milk or saliva (do NOT scrub the root) and see a dentist within 30–60 minutes for the highest replantation success.\n\n3. **Uncontrolled Bleeding**: Apply firm, continuous pressure with sterile gauze for 20 minutes. If bleeding persists, go to the nearest emergency room.\n\n> ⚠️ *Gardy Assistant is for clinical decision support and educational reference only. It does not replace emergency medical care.*`,
          timestamp: Date.now()
        },
        suggestedFollowUps: [
          'How do I manage patient appointments?',
          'What does the AI dental X-ray diagnosis mean?',
          'Where can I find the clinic directory?'
        ],
        disclaimer: 'AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.'
      });
    }

    const isPatientUser =
      role === 'PATIENT' ||
      Boolean(context?.currentPath?.startsWith('/patient') || context?.currentPath?.includes('/patient'));

    if (/clinical significance.*radiographical indicators|explain.*differential considerations/i.test(msg)) {
      const nextStepLink = isPatientUser
        ? '[Book Consultation](/patient/book)'
        : '[Open AI Workstation](/clinic/ai-workstation) • [View Patient Directory](/clinic/patients)';

      reply = `${emergencyPrefix}### 🔬 Radiographic Findings & Clinical Significance\n\nWhen evaluating pathology on a dental panoramic radiograph (OPG) within SmileGuard AI:\n\n1. **Diagnostic Decision Support Interpretation**:\n   - Review the primary neural prediction in correlation with the anatomical quadrant and tooth surface.\n   - Inspect the **Pre-Softmax Grad-CAM Heatmap** (layer \`top_activation\`) to observe which radiolucent or radiopaque pixels influenced the model.\n\n2. **Clinical Correlation Required**:\n   - Check tooth vitality (thermal/electric pulp test) and percussion response.\n   - Examine coronal margins for restoration failure or recurrent demineralization.\n   - Obtain targeted periapical or bitewing radiographs for definitive interproximal bone level evaluation.\n\n3. **Recommended Next Steps**:\n   - Log clinician verification in the sign-off panel.\n   - ${nextStepLink}\n\n> ⚠️ **Clinical Decision Support Disclaimer**:\n> *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*`;
      followUps = [
        'How do I copy a SOAP clinical note for this finding?',
        'How does pre-softmax Grad-CAM avoid saturation?',
        'What are the classification confidence thresholds?'
      ];
    } else if (/appointment|booking|schedule|queue|triage/i.test(msg)) {
      reply = `${emergencyPrefix}### 📅 Managing Patient Appointments in SmileGuard AI\n\n1. **Chairside Triage Queue**:\n   - Review incoming booking requests in real time at [View Appointments Queue](/clinic/queue).\n   - Stage progression: \`PENDING\` ➔ \`CONFIRMED\` ➔ \`IN_CHAIR\` ➔ \`COMPLETED\`.\n   - Rejecting an appointment requires entering a clinical reason.\n\n2. **Conflict Prevention**:\n   - SmileGuard AI automatically detects and blocks double-booking for the same dentist.\n\n3. **Patient Experience**:\n   - Patients can book in 3 steps at [Book Appointment](/patient/book) with automatic confirmation notifications.`;
      followUps = [
        'What does the AI dental X-ray diagnosis mean?',
        'How do I register a new patient?',
        'Where can I see active treatment plans?'
      ];
    } else if (/x-ray|xray|opg|diagnosis|diagnostic|caries|impacted|infection|gradcam|grad-cam/i.test(msg)) {
      const actionItem = isPatientUser
        ? 'Your dentist reviews your radiographs using SmileGuard AI diagnostic tools during your appointment.'
        : '[Open AI Workstation](/clinic/ai-workstation)';

      reply = `${emergencyPrefix}### 🔬 SmileGuard Two-Stage CNN Diagnostic Pipeline\n\n1. **Stage 1: OPG Validator Gatekeeper (MobileNetV2)**\n   - Verifies if the image is an authentic Dental Panoramic Radiograph (OPG).\n   - Non-OPG images (photos, selfies) are rejected with status \`422 INVALID_XRAY\`.\n\n2. **Stage 2: Pathology Classifier (EfficientNetB0)**\n   - Evaluates verified OPGs for:\n     * **Dental Caries**: Radiolucent enamel/dentin demineralization.\n     * **Impacted Teeth**: Blocked third molar eruption or angulation.\n     * **Infection / Periapical Lesions**: Periapical radiolucency / apical periodontitis at the root apex.\n     * **Periodontal Bone Loss / BDC-BDR / Healthy Teeth**.\n\n3. **Explainability with Pre-Softmax Grad-CAM**:\n   - Computes activation gradients on layer \`top_activation\` with a Jet colormap overlay.\n   - ${actionItem}\n\n> ⚠️ **Clinical Decision Support Disclaimer**:\n> *AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.*`;
      followUps = [
        'How does the Stage-1 validator reject non-OPG images?',
        'What is Grad-CAM explainability?',
        'How do I book an appointment?'
      ];
    } else if (/lab|laboratory|cad|cam|crown|retainer|aligner/i.test(msg)) {
      reply = `${emergencyPrefix}### 🦷 Dental Laboratory & CAD/CAM Management\n\nSmileGuard AI manages the digital appliance workflow at [Open CAD/CAM Lab Orders](/clinic/lab-orders):\n\n- **Prescriptions**: Zirconia crowns, e.max veneers, Hawley retainers, orthodontic aligners, and bridges.\n- **6-Stage Production Pipeline**:\n  1. \`Received\`: Prescription received.\n  2. \`Design (CAD)\`: 3D computer-aided modeling.\n  3. \`Milling (CAM)\`: Digital milling / 3D printing.\n  4. \`Glazing/Baking\`: Sintering and staining.\n  5. \`QA/Inspection\`: Margin fit and occlusion check.\n  6. \`Dispatched\`: Shipped to clinic for fitting.`;
      followUps = [
        'How do I create a new lab order?',
        'What appliances are supported?',
        'Where can dentists check lab order status?'
      ];
    } else if (/patient|register|odontogram|chart/i.test(msg)) {
      reply = `${emergencyPrefix}### 📋 Patient Management & 32-Tooth Odontogram\n\n1. **Patient Directory**:\n   - Access case files and health histories complying with RA 10173 at [Go to Patient Directory](/clinic/patients).\n\n2. **32-Tooth Interactive Adult Odontogram**:\n   - Anatomical charting supporting Universal and FDI notations.\n   - 5 surfaces per tooth: **Mesial**, **Distal**, **Occlusal/Incisal**, **Buccal**, and **Lingual**.\n   - Statuses: *Sound*, *Caries*, *Filled*, *Crown*, *Bridge*, *Missing*, *Endodontic Treated*, *Extraction Indicated*.`;
      followUps = [
        'How do I record findings on the 32-tooth odontogram?',
        'How does medical onboarding comply with RA 10173?',
        'How do I manage patient appointments?'
      ];
    } else {
      if (isPatientUser) {
        reply = `${emergencyPrefix}Hello! I'm **Gardy Assistant**. I can help you understand your dental health, prepare for visits, and assist with appointments:\n\n- **Book an Appointment**: Schedule your next dental visit or consultation.\n- **Oral Health & Care**: Tips for daily brushing, cavity prevention, and oral hygiene.\n- **Understanding Procedures**: Learn about cleanings, fillings, radiographs, and orthodontic care.\n\nQuick Links: [Book Appointment](/patient/book)\n\nHow can I help you today?`;
        followUps = [
          'How do I book an appointment?',
          'How do daily brushing streaks work?',
          'What should I do if I have a toothache?'
        ];
      } else {
        reply = `${emergencyPrefix}Hello! I'm **Gardy Assistant**. I can help you navigate SmileGuard AI, understand dental conditions, and assist with your clinic workflows:\n\n- **Appointment Management**: Triage queue stages and conflict-free booking.\n- **AI Radiograph Diagnostics**: 2-stage CNN OPG validator and Grad-CAM pathology analysis.\n- **Patient Records & Odontogram**: 32-tooth interactive anatomical charting.\n- **Dental Laboratory**: CAD/CAM orders and fabrication pipeline.\n\nQuick Links: [Open AI Workstation](/clinic/ai-workstation) • [View Appointments Queue](/clinic/queue)\n\nHow can I help you today?`;
      }
    }

    return res.status(200).json({
      success: true,
      message: {
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      },
      suggestedFollowUps: followUps,
      model: 'smileguard-clinical-engine-v2',
      disclaimer: 'AI-generated results are intended for clinical decision support only and must be reviewed and validated by a qualified dental professional.'
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: {
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again in a moment.',
        timestamp: Date.now()
      }
    });
  }
}
