// NOX POC — Complete Seed Data
// Derived from Bash's actual SOP documents and Communication Guidance

const config = {
  llm_provider: 'anthropic',
  model_name: 'claude-sonnet-4-6',
  temperature: '0.3',
  max_tokens: '1024',
  brand_greeting: "Hi — I'm NOX, Bashstore Support assistant. How can I help?",
  routing_question: "Which of these is it: order / delivery / return / payment / device / promo?",
  escalation_message: "I'm going to hand this over to the Bashstore Support team now so they can assist.",
  pre_handover_prompt: "Before I hand over, please confirm: store name, branch code, and {relevant_identifier}.",
  handover_destination: "Bashstore Support group",
  system_prompt_preamble: "",
  system_prompt_suffix: ""
};

const guardrails = [
  {
    rule: "Guide-only truthfulness",
    description: "Only reference content from approved SOPs. Never invent steps, policies, timelines, or internal processes. Never claim to have checked systems."
  },
  {
    rule: "No system-claiming",
    description: "Never say 'system says', 'I checked your account', 'I can see your payment', or any phrase implying access to internal systems."
  },
  {
    rule: "Feitian = handover only",
    description: "If device is Feitian (F31Q), collect identifiers and hand over immediately. No troubleshooting."
  },
  {
    rule: "Sunmi = troubleshoot then handover",
    description: "For Sunmi devices, follow SOP troubleshooting steps. Hand over only if troubleshooting fails."
  },
  {
    rule: "Clear cache only, never clear data",
    description: "In any device troubleshooting, instruct to clear cache ONLY. NEVER instruct to clear data."
  },
  {
    rule: "Restart after Finmo PIN",
    description: "After any Finmo PIN reset step, always instruct device restart before testing."
  },
  {
    rule: "Identifiers before troubleshooting",
    description: "Always collect required identifiers before providing any troubleshooting steps."
  },
  {
    rule: "SOP scope boundary",
    description: "If the answer is not in SOP 001–026, ask one clarifying question. If still unclear, hand over. Never guess."
  },
  {
    rule: "No exceptions or promises",
    description: "NOX must not approve exceptions, promise immediate refunds, or say 'I have processed' anything."
  },
  {
    rule: "Charger safety",
    description: "When device charging is mentioned, always specify: 5V / 2A (10W) approved charger. Do not use higher-wattage fast chargers."
  }
];

const toneRules = [
  // === Voice & Tone ===
  { rule_type: 'voice_tone', content: 'Be clear, calm, and practical.' },
  { rule_type: 'voice_tone', content: 'Sound like a helpful support teammate, not a chatbot.' },
  { rule_type: 'voice_tone', content: 'Default to neutral and respectful.' },
  { rule_type: 'voice_tone', content: 'Avoid jokes, sarcasm, slang, or emojis.' },
  { rule_type: 'voice_tone', content: 'Use short sentences. One instruction per line.' },
  { rule_type: 'voice_tone', content: 'Never guilt or blame. Use "Let\'s check…" and "Please confirm…"' },

  // === Vocabulary — Use ===
  { rule_type: 'vocabulary_use', content: '"store", "store staff", "branch", "order number", "device serial", "error message", "step", "handover"' },
  { rule_type: 'vocabulary_use', content: '"I can guide you through the steps in our SOP."' },
  { rule_type: 'vocabulary_use', content: '"If this doesn\'t resolve it, I\'ll hand over to the support team."' },

  // === Vocabulary — Avoid ===
  { rule_type: 'vocabulary_avoid', content: '"I guarantee", "I promise", "definitely", "100%"' },
  { rule_type: 'vocabulary_avoid', content: '"system says", "I checked your account", "I can see your payment" — no system-claiming' },
  { rule_type: 'vocabulary_avoid', content: 'Policy/legal language (unless explicitly in an SOP)' },

  // === Forbidden Phrases ===
  { rule_type: 'forbidden_phrase', content: 'I guarantee' },
  { rule_type: 'forbidden_phrase', content: 'I promise' },
  { rule_type: 'forbidden_phrase', content: 'definitely' },
  { rule_type: 'forbidden_phrase', content: '100%' },
  { rule_type: 'forbidden_phrase', content: 'system says' },
  { rule_type: 'forbidden_phrase', content: 'I checked your account' },
  { rule_type: 'forbidden_phrase', content: 'I can see your payment' },
  { rule_type: 'forbidden_phrase', content: 'I can see your order' },
  { rule_type: 'forbidden_phrase', content: 'As an AI' },
  { rule_type: 'forbidden_phrase', content: 'I apologize for the inconvenience' },
  { rule_type: 'forbidden_phrase', content: 'I have processed' },
  { rule_type: 'forbidden_phrase', content: 'Your refund has been approved' },
  { rule_type: 'forbidden_phrase', content: 'Clear Data' },

  // === Reply Structure ===
  { rule_type: 'structure_rule', content: 'Keep replies short and scannable.' },
  { rule_type: 'structure_rule', content: '1. Acknowledge + name the scenario (if known).' },
  { rule_type: 'structure_rule', content: '2. Collect required identifiers first.' },
  { rule_type: 'structure_rule', content: '3. Provide numbered steps (max 3–6 steps at a time).' },
  { rule_type: 'structure_rule', content: '4. Ask one confirmation question (what they see now).' },
  { rule_type: 'structure_rule', content: '5. If needed: state handover and what to provide next.' },

  // === Identifier Rules ===
  { rule_type: 'identifier_rule', content: 'Ask for identifiers BEFORE troubleshooting or explaining.' },
  { rule_type: 'identifier_rule', content: 'If the user cannot provide an identifier, ask for an alternative allowed in the SOP (screenshot, exact wording).' },
  { rule_type: 'identifier_rule', content: 'If still blocked after alternative request, hand over.' },

  // === Step Delivery ===
  { rule_type: 'step_delivery_rule', content: 'Give steps in small batches (max 3–6 at a time).' },
  { rule_type: 'step_delivery_rule', content: 'After steps, ALWAYS ask for the result.' },
  { rule_type: 'step_delivery_rule', content: 'Use format: 1. Do X. 2. Do Y. 3. Do Z. → "What do you see now?"' },

  // === Uncertainty Handling ===
  { rule_type: 'uncertainty_rule', content: 'If the description doesn\'t match the SOP scenario, ask 1–2 clarifying questions.' },
  { rule_type: 'uncertainty_rule', content: 'If still unclear after 2 questions, hand over with a structured summary.' },

  // === Reusable Phrases ===
  { rule_type: 'reusable_phrase', content: '"Please share the exact error message (copy/paste)."' },
  { rule_type: 'reusable_phrase', content: '"If you can, send a screenshot of the message on screen."' },
  { rule_type: 'reusable_phrase', content: '"I can guide the next steps from our SOP."' },
  { rule_type: 'reusable_phrase', content: '"If this does not resolve it, we will hand over to a human agent."' },

  // === Escalation Language ===
  { rule_type: 'escalation_phrase', content: '"I\'m going to hand this over to the Bashstore Support team now so they can assist."' },
  { rule_type: 'escalation_phrase', content: '"Before I hand over, please confirm: store name, branch code, and (order number / device serial)."' },
];

const baselineFields = [
  { field_name: 'store_name', display_name: 'Store Name', field_type: 'text', required: true, is_baseline: true, sort_order: 0 },
  { field_name: 'staff_name', display_name: 'Staff Full Name', field_type: 'text', required: true, is_baseline: true, sort_order: 1 },
  { field_name: 'branch_code', display_name: 'Branch Code', field_type: 'text', required: true, is_baseline: true, sort_order: 2 },
];

// ═══════════════════════════════════════════
// Full Build Scenarios (SOPs 001–010)
// ═══════════════════════════════════════════

const fullScenarios = [
  // SOP 001 — Order Tracking & Status
  {
    sop_number: 'SOP-001',
    name: 'order_tracking',
    display_name: 'Order Tracking & Status',
    description: 'Store asks to track an order or give a status update.',
    category: 'order',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', field_type: 'text', required: true, is_baseline: false, validation_hint: 'Format: B########-01', sort_order: 1 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'order_channel', display_name: 'Order Channel', field_type: 'select', required: true, is_baseline: false, description: 'How the order was placed', select_options: '["Store-assisted (BashStore device)", "Customer-direct (app/web)"]', sort_order: 5 },
      { field_name: 'order_lookup_status', display_name: 'Order Lookup Status', field_type: 'text', required: false, is_baseline: false, description: 'If store already checked Order Lookup: what they saw (status + timestamp)', sort_order: 6 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Look up the order",
          steps: [
            "On device: open BashStore → Order Lookup → search using the order number.",
            "Open the order to view the current status."
          ],
          check: "What status do you see on the order?"
        },
        {
          label: "If status is 'With courier'",
          condition: "Status shows 'With courier'",
          steps: [
            "Open Track Parcel.",
            "Share the tracking number with the customer.",
            "Share the expected lead time with the customer."
          ],
          check: "Were you able to find the tracking number?"
        },
        {
          label: "If status is 'Ready for collection'",
          condition: "Status shows 'Ready for collection'",
          steps: [
            "Remind the customer to collect within the allowed window.",
            "Remind them to bring ID and the order number."
          ],
          check: "Has the customer been informed?"
        }
      ],
      handover_triggers: [
        "Order not found in Order Lookup.",
        "Status is unclear or does not match expected options.",
        "Store cannot access Order Lookup.",
        "Order is customer-direct (not placed via BashStore device) and resolution requires Customer Support."
      ],
      handover_payload: [
        "Order number",
        "Customer details (name, email, cellphone)",
        "What the store saw in Order Lookup (status + timestamp)",
        "Whether this is store-assisted (BashStore) or customer-direct"
      ]
    })
  },

  // SOP 002 — Invoice / Receipt Requests
  {
    sop_number: 'SOP-002',
    name: 'invoice_receipt',
    display_name: 'Invoice / Receipt Requests',
    description: 'Store asks for an invoice, receipt, slip, or tax invoice. Includes split payment nuance.',
    category: 'order',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', field_type: 'text', required: true, is_baseline: false, sort_order: 1 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'invoice_purpose', display_name: 'Invoice Purpose', field_type: 'select', required: true, is_baseline: false, select_options: '["Return/exchange in-store", "Insurance/tax/admin purposes"]', sort_order: 5 },
      { field_name: 'order_channel', display_name: 'Order Channel', field_type: 'select', required: true, is_baseline: false, select_options: '["Store-assisted (BashStore device)", "Customer-direct (app/web)"]', sort_order: 6 },
      { field_name: 'is_split_payment', display_name: 'Split Payment?', field_type: 'select', required: false, is_baseline: false, select_options: '["Yes", "No", "Not sure"]', sort_order: 7 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Locate the invoice",
          steps: [
            "On POS/device: open BashStore → Order Lookup → open the order.",
            "Navigate to Delivery Details / Invoices section.",
            "View, print, or email the invoice."
          ],
          check: "Can you see the invoice in the order details?"
        },
        {
          label: "If invoice is missing",
          condition: "Invoice not found in order details",
          steps: [
            "Confirm whether this was a split payment order (invoice spikes can be linked to split payments).",
            "Capture the order number, customer details, and payment method.",
            "This will need to be escalated."
          ],
          check: "Was this a split payment order?"
        }
      ],
      handover_triggers: [
        "Invoice not present in the order.",
        "Invoice download fails repeatedly.",
        "Split payment order requiring manual invoice generation."
      ],
      handover_payload: [
        "Order number",
        "Customer details (name, email, cellphone)",
        "Whether this is a split payment order"
      ]
    })
  },

  // SOP 003 — Returns Processing (guide-only)
  {
    sop_number: 'SOP-003',
    name: 'returns_processing',
    display_name: 'Returns Processing',
    description: 'Store asks how to log a return or exchange on behalf of a customer. Guide-only — NOX provides process guidance but does not execute returns.',
    category: 'return',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_channel', display_name: 'Order Channel', field_type: 'select', required: true, is_baseline: false, select_options: '["Store-assisted (BashStore device)", "Customer-direct (app/web)"]', sort_order: 1 },
      { field_name: 'order_number', display_name: 'Order Number', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 5 },
      { field_name: 'return_reason', display_name: 'Return Reason', field_type: 'select', required: true, is_baseline: false, select_options: '["Not suitable / changed mind", "Damaged", "Wrong item", "Missing item", "Defective"]', sort_order: 6 },
      { field_name: 'delivery_date', display_name: 'Delivery/Collection Date (approx)', field_type: 'text', required: false, is_baseline: false, description: 'When the item was delivered or collected', sort_order: 7 },
      { field_name: 'photos_available', display_name: 'Photos/Evidence Available?', field_type: 'select', required: false, is_baseline: false, select_options: '["Yes", "No"]', sort_order: 8 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Determine return method",
          steps: [
            "Confirm whether the return should be logged in-store or via courier collection."
          ],
          check: "Will this be an in-store return or courier collection?"
        },
        {
          label: "Guide to returns flow",
          condition: "Store needs process steps",
          steps: [
            "Guide the store to follow the approved returns flow on the relevant system (POS / Baxter / returns tooling).",
            "Note: some return types require additional verification — photos, collection booking, or DC assessment — and may take longer."
          ],
          check: "Were you able to find the returns flow on the system?"
        }
      ],
      scenario_guardrails: [
        "NOX must NOT approve exceptions.",
        "NOX must NOT promise immediate refunds.",
        "NOX must NOT say 'I have processed' anything."
      ],
      handover_triggers: [
        "Any case involving refunds or disputes.",
        "High-value items, jewellery, or home/furniture.",
        "Customer says they already returned the item but refund is overdue.",
        "Store cannot find the right flow/tool to log the return."
      ],
      handover_payload: [
        "Order number",
        "Customer details (name, email, cellphone)",
        "Return reason category",
        "Whether store-assisted or customer-direct",
        "Photos/evidence if available",
        "What the store tried and where they got stuck"
      ]
    })
  },

  // SOP 004 — Device scanner not working (Sunmi only)
  {
    sop_number: 'SOP-004',
    name: 'device_scanner_not_working',
    display_name: 'Device Scanner Not Working',
    description: 'Device scanner is not functioning. Sunmi only — Feitian is immediate handover.',
    category: 'device',
    build_status: 'full',
    device_type: 'sunmi',
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', field_type: 'select', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]', sort_order: 1 },
      { field_name: 'device_serial', display_name: 'Device Serial Number', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'error_message', display_name: 'Error Message', field_type: 'text', required: false, is_baseline: false, description: 'Exact error or description of behaviour', sort_order: 3 },
    ],
    troubleshooting_steps: JSON.stringify({
      hard_split: {
        field: "device_type",
        feitian: "Handover immediately. No troubleshooting for Feitian (F31Q) devices.",
        sunmi: "Proceed with troubleshooting steps."
      },
      step_groups: [
        {
          label: "Sunmi scanner troubleshooting",
          condition: "Device is Sunmi",
          steps: [
            "Restart the device (hold power button for about 10 seconds).",
            "Open BashStore.",
            "Go to settings and locate scanner settings.",
            "Toggle 'Enable Scanner' off, then on again.",
            "Test with any barcode."
          ],
          check: "Is the scanner working now?"
        }
      ],
      handover_triggers: [
        "Feitian device (immediate handover).",
        "Scanner still not working after completing all steps."
      ],
      handover_payload: [
        "Device serial number",
        "What was tried",
        "Any error messages"
      ]
    })
  },

  // SOP 005 — Wi-Fi connectivity
  {
    sop_number: 'SOP-005',
    name: 'wifi_connectivity',
    display_name: 'Wi-Fi Connectivity Issues',
    description: 'Device cannot connect to Wi-Fi, or errors like "web page not available". Sunmi only — Feitian is immediate handover.',
    category: 'device',
    build_status: 'full',
    device_type: 'sunmi',
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', field_type: 'select', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]', sort_order: 1 },
      { field_name: 'device_serial', display_name: 'Device Serial Number', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'error_message', display_name: 'Error Message', field_type: 'text', required: false, is_baseline: false, description: 'Exact error or screenshot', sort_order: 3 },
      { field_name: 'other_devices_affected', display_name: 'Other Devices Also Offline?', field_type: 'select', required: true, is_baseline: false, select_options: '["Yes", "No", "Not sure"]', description: 'If multiple devices offline, likely a store Wi-Fi/server issue', sort_order: 4 },
    ],
    troubleshooting_steps: JSON.stringify({
      hard_split: {
        field: "device_type",
        feitian: "Handover immediately. No store troubleshooting for Feitian (F31Q).",
        sunmi: "Proceed with troubleshooting steps."
      },
      early_escalation: {
        condition: "Multiple devices in the same store are offline",
        action: "Treat as a store Wi-Fi/server issue and escalate early. Do not troubleshoot individual devices."
      },
      step_groups: [
        {
          label: "Forget and reconnect to Wi-Fi",
          condition: "Device is Sunmi AND issue is isolated to this device",
          steps: [
            "Swipe down and long-press the Wi-Fi icon.",
            "Find 'tfg stores' Wi-Fi.",
            "Press and hold it, then choose 'Forget network'.",
            "Tap 'tfg stores' again."
          ],
          check: "Do you see the Wi-Fi settings screen now?"
        },
        {
          label: "Enter Wi-Fi credentials",
          condition: "Wi-Fi settings screen is showing",
          steps: [
            "Set EAP method = PEAP (keep as-is).",
            "Phase 2 authentication = keep as-is (typically MSCHAPV2).",
            "CA certificate = 'Do not validate'.",
            "IMPORTANT: If you still see 'Domain' or 'Online certificate', the CA certificate step is wrong — go back and set it to 'Do not validate'.",
            "Identity = tfgstores\\BashPOS",
            "Anonymous identity = leave blank.",
            "Password = !MpF261LZ%1T"
          ],
          check: "Were you able to enter all the settings? What do you see now?"
        },
        {
          label: "Connect and restart",
          steps: [
            "Tap Connect.",
            "Restart the device."
          ],
          check: "Is the device connected to Wi-Fi now?"
        }
      ],
      support_note: "If the store is stuck entering credentials, support can share the credentials so store staff can enter them, or support can remote control the device (if available) and enter credentials manually.",
      handover_triggers: [
        "Feitian device (immediate handover).",
        "IP configuration error.",
        "Repeated failure after correct settings entered.",
        "Store Wi-Fi/server down (multiple devices affected)."
      ],
      handover_payload: [
        "Store name + branch code",
        "Device type + serial number",
        "Exact error message + screenshot",
        "Whether other devices are affected",
        "What was tried"
      ]
    })
  },

  // SOP 006 — App crashes or freezes (Sunmi only)
  {
    sop_number: 'SOP-006',
    name: 'app_crash_freeze',
    display_name: 'App Crashes or Freezes',
    description: 'BashStore app crashes or freezes on device. Sunmi only — Feitian is immediate handover.',
    category: 'device',
    build_status: 'full',
    device_type: 'sunmi',
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', field_type: 'select', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]', sort_order: 1 },
      { field_name: 'device_serial', display_name: 'Device Serial Number', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'error_message', display_name: 'Error Message', field_type: 'text', required: false, is_baseline: false, sort_order: 3 },
    ],
    troubleshooting_steps: JSON.stringify({
      hard_split: {
        field: "device_type",
        feitian: "Handover immediately. No troubleshooting for Feitian (F31Q).",
        sunmi: "Proceed with troubleshooting steps."
      },
      step_groups: [
        {
          label: "Check charger and close apps",
          condition: "Device is Sunmi",
          steps: [
            "Ensure the device is charging with an approved charger: 5V / 2A (10W). Do NOT use higher-wattage fast chargers.",
            "Close all apps (swipe up, clear all)."
          ],
          check: "Is the device charging with the correct charger? All apps closed?"
        },
        {
          label: "Clear cache and restart",
          steps: [
            "Go to Settings → Apps → BashStore.",
            "Tap 'Clear Cache'. (NEVER tap 'Clear Data'.)",
            "Restart the device.",
            "Open BashStore."
          ],
          check: "Is the app working now?"
        }
      ],
      handover_triggers: [
        "Feitian device (immediate handover).",
        "App still crashing after all steps completed."
      ],
      handover_payload: [
        "Device serial number",
        "What was tried",
        "Any error messages"
      ]
    })
  },

  // SOP 007 — Finmo PIN / card payment settings error
  {
    sop_number: 'SOP-007',
    name: 'finmo_pin_error',
    display_name: 'Finmo PIN / Card Payment Settings Error',
    description: 'Finmo PIN issue or card payment settings error. Requires app version check before proceeding. Sunmi only — Feitian is immediate handover.',
    category: 'payment',
    build_status: 'full',
    device_type: 'sunmi',
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', field_type: 'select', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]', sort_order: 1 },
      { field_name: 'device_serial', display_name: 'Device Serial Number', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'failure_detail', display_name: 'What Exactly Failed', field_type: 'text', required: true, is_baseline: false, description: 'Tap failed? Insert failed? Specific error?', sort_order: 3 },
      { field_name: 'app_version', display_name: 'BashStore App Version', field_type: 'text', required: true, is_baseline: false, description: 'REQUIRED — payment issues can be linked to out-of-date apps', sort_order: 4 },
      { field_name: 'error_message', display_name: 'Error Message', field_type: 'text', required: false, is_baseline: false, sort_order: 5 },
    ],
    troubleshooting_steps: JSON.stringify({
      hard_split: {
        field: "device_type",
        feitian: "Handover immediately. No troubleshooting for Feitian (F31Q).",
        sunmi: "Proceed with troubleshooting steps."
      },
      important_note: "Payment issues can be linked to devices being out of date. Always confirm BashStore app version before escalation.",
      step_groups: [
        {
          label: "Check charger and update app",
          condition: "Device is Sunmi",
          steps: [
            "Ensure the device is charging with an approved charger: 5V / 2A (10W). Do NOT use higher-wattage fast chargers.",
            "Check the BashStore app version. If out of date, update it first."
          ],
          check: "What app version is showing? Is it up to date?"
        },
        {
          label: "Reset Finmo PIN and restart",
          steps: [
            "Go to Profile → Set Finmo PIN.",
            "Enter PIN (per support process).",
            "Restart the device.",
            "Test a small transaction."
          ],
          check: "Were you able to set the PIN and complete a test transaction?"
        }
      ],
      handover_triggers: [
        "Feitian device (immediate handover).",
        "Still failing after app update + PIN reset + restart.",
        "Payment app missing from device.",
        "Repeated errors on test transaction."
      ],
      handover_payload: [
        "Device serial number",
        "BashStore app version",
        "Exact error message",
        "What was tried"
      ]
    })
  },

  // SOP 008 — Missed delivery or not collected
  {
    sop_number: 'SOP-008',
    name: 'missed_delivery',
    display_name: 'Missed Delivery or Not Collected',
    description: 'Delivery was missed or customer did not collect their order within the window.',
    category: 'delivery',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', field_type: 'text', required: true, is_baseline: false, sort_order: 1 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'delivery_method', display_name: 'Delivery or Collection', field_type: 'select', required: true, is_baseline: false, select_options: '["Home delivery", "Click & Collect"]', sort_order: 5 },
      { field_name: 'expected_date', display_name: 'Expected Delivery/Collection Date', field_type: 'text', required: true, is_baseline: false, sort_order: 6 },
      { field_name: 'checked_order_lookup', display_name: 'Already Checked Order Lookup?', field_type: 'select', required: true, is_baseline: false, select_options: '["Yes", "No"]', sort_order: 7 },
      { field_name: 'order_lookup_status', display_name: 'Order Lookup Status', field_type: 'text', required: false, is_baseline: false, description: 'If yes: what status and timestamp showed', sort_order: 8 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Explain delivery/collection status",
          steps: [
            "Explain delivery attempt process or collection window to the store.",
            "If the order was returned to warehouse: set expectation on refund timeline."
          ],
          check: "Does that clarify the situation, or does the customer need further action?"
        }
      ],
      handover_triggers: [
        "Refund overdue.",
        "Dispute — customer claims they collected/received but records show otherwise (or vice versa)."
      ],
      handover_payload: [
        "Order number",
        "Customer details (name, email, cellphone)",
        "What the store saw in Order Tracker"
      ]
    })
  },

  // SOP 009 — Delayed or missing refunds
  {
    sop_number: 'SOP-009',
    name: 'delayed_missing_refund',
    display_name: 'Delayed or Missing Refunds',
    description: 'Customer refund has not arrived or is delayed beyond expected timeline.',
    category: 'payment',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', field_type: 'text', required: true, is_baseline: false, sort_order: 1 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'refund_date', display_name: 'Expected Refund Date', field_type: 'text', required: false, is_baseline: false, sort_order: 5 },
      { field_name: 'refund_amount', display_name: 'Refund Amount', field_type: 'text', required: true, is_baseline: false, validation_hint: 'In ZAR', sort_order: 6 },
      { field_name: 'payment_method', display_name: 'Original Payment Method', field_type: 'text', required: true, is_baseline: false, sort_order: 7 },
      { field_name: 'on_behalf_of_customer', display_name: 'Store Querying on Behalf of Customer?', field_type: 'select', required: true, is_baseline: false, select_options: '["Yes", "No"]', sort_order: 8 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Check refund timeline",
          steps: [
            "Explain the standard refund timeline for the payment method used.",
            "Ask how many working days have passed since the refund was initiated."
          ],
          check: "How many working days has it been since the refund was processed?"
        }
      ],
      handover_triggers: [
        "Refund is overdue beyond the standard timeline for the payment method.",
        "Wrong amount was refunded.",
        "Customer's bank confirms no refund received."
      ],
      handover_payload: [
        "Order number",
        "Customer details (name, email, cellphone)",
        "Refund method + amount + expected date"
      ]
    })
  },

  // SOP 010 — Payment failed but charged / no order
  {
    sop_number: 'SOP-010',
    name: 'payment_failed_charged',
    display_name: 'Payment Failed but Charged / No Order Generated',
    description: 'Customer was charged but no order was generated, or payment shows as failed but money was deducted.',
    category: 'payment',
    build_status: 'full',
    device_type: null,
    handover_trigger: 'after_troubleshooting',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number (if any)', field_type: 'text', required: false, is_baseline: false, sort_order: 1 },
      { field_name: 'customer_name', display_name: 'Customer Full Name', field_type: 'text', required: true, is_baseline: false, sort_order: 2 },
      { field_name: 'customer_cellphone', display_name: 'Customer Cellphone', field_type: 'phone', required: true, is_baseline: false, sort_order: 3 },
      { field_name: 'customer_email', display_name: 'Customer Email', field_type: 'email', required: true, is_baseline: false, sort_order: 4 },
      { field_name: 'transaction_datetime', display_name: 'Transaction Date/Time', field_type: 'text', required: true, is_baseline: false, sort_order: 5 },
      { field_name: 'amount', display_name: 'Amount Charged', field_type: 'text', required: true, is_baseline: false, validation_hint: 'In ZAR', sort_order: 6 },
      { field_name: 'payment_method', display_name: 'Payment Method', field_type: 'text', required: true, is_baseline: false, sort_order: 7 },
      { field_name: 'order_channel', display_name: 'Order Channel', field_type: 'select', required: true, is_baseline: false, select_options: '["Store-assisted (BashStore device)", "Customer-direct (app/web)"]', sort_order: 8 },
      { field_name: 'error_message', display_name: 'Error Message / What Device Shows', field_type: 'text', required: false, is_baseline: false, description: 'Exact wording on screen, or screenshot', sort_order: 9 },
    ],
    troubleshooting_steps: JSON.stringify({
      step_groups: [
        {
          label: "Check for existing order",
          steps: [
            "Check whether an order exists in Order Tracker using any available details (order number, customer email, transaction date).",
            "If no order exists: explain that there may be an auto-reversal window for the charge (where applicable)."
          ],
          check: "Does an order appear in Order Tracker, or is there no matching order?"
        }
      ],
      handover_triggers: [
        "No order found after the expected auto-reversal window.",
        "Repeat occurrences of the same issue.",
        "Customer insists charge is not reversed."
      ],
      handover_payload: [
        "Order number (if any)",
        "Customer details (name, email, cellphone)",
        "Transaction date/time",
        "Amount charged",
        "Payment method",
        "What the store sees on device/POS (exact wording)",
        "Screenshots or exact error message (if available)"
      ]
    })
  },
];

// ═══════════════════════════════════════════
// Handover Only Scenarios (SOPs 011–026)
// ═══════════════════════════════════════════

const handoverOnlyScenarios = [
  {
    sop_number: 'SOP-011', name: 'egift_ghost_order',
    display_name: 'eGift Card Ghost Order / Gateway Error',
    description: 'eGift card order shows as ghost order or communication error with payment gateway.',
    category: 'payment', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: true, is_baseline: false },
      { field_name: 'error_message', display_name: 'Error Message', required: false, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-012', name: 'device_reallocation',
    display_name: 'Device Reallocation / SOTI Rename',
    description: 'Incorrect branch/domain showing on device. Requires SOTI rename.',
    category: 'device', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]' },
      { field_name: 'device_serial', display_name: 'Device Serial Number', required: true, is_baseline: false },
      { field_name: 'current_branch_showing', display_name: 'Branch Currently Showing', required: true, is_baseline: false },
      { field_name: 'correct_branch', display_name: 'Correct Branch', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-013', name: 'bashstore_login',
    display_name: 'BashStore Login Issues',
    description: 'Staff cannot log into the BashStore app.',
    category: 'device', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'device_type', display_name: 'Device Type', required: true, is_baseline: false, select_options: '["Sunmi", "Feitian"]' },
      { field_name: 'device_serial', display_name: 'Device Serial Number', required: true, is_baseline: false },
      { field_name: 'error_message', display_name: 'Error Message', required: false, is_baseline: false },
      { field_name: 'username', display_name: 'Username / Login ID', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-014', name: 'checkout_error',
    display_name: 'Checkout Error / Cannot Place Order',
    description: 'Error occurs during checkout or order cannot be placed.',
    category: 'order', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'error_message', display_name: 'Error Message', required: true, is_baseline: false },
      { field_name: 'payment_method', display_name: 'Payment Method', required: false, is_baseline: false },
      { field_name: 'device_type', display_name: 'Device Type', required: false, is_baseline: false, select_options: '["Sunmi", "Feitian"]' },
    ]
  },
  {
    sop_number: 'SOP-015', name: 'gift_card_issue',
    display_name: 'Gift Card Issue (incl. eGift OTP)',
    description: 'Gift card not working, eGift OTP not received, or balance issues.',
    category: 'payment', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'gift_card_number', display_name: 'Gift Card Number', required: true, is_baseline: false },
      { field_name: 'error_message', display_name: 'Error Message', required: false, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-016', name: 'otp_issues',
    display_name: 'OTP Issues (C&C / Staff Discount / Gift Card)',
    description: 'OTP not received or not working for Click & Collect, staff discount, or gift card.',
    category: 'payment', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'otp_context', display_name: 'OTP Context', required: true, is_baseline: false, description: 'Click & Collect, staff discount, or gift card' },
      { field_name: 'phone_number', display_name: 'Phone Number', required: false, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-017', name: 'onestock_issue',
    display_name: 'OneStock Issue (Availability / Fulfilment)',
    description: 'Stock availability or fulfilment issue in OneStock.',
    category: 'order', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: false, is_baseline: false },
      { field_name: 'sku', display_name: 'Item SKU', required: false, is_baseline: false },
      { field_name: 'error_message', display_name: 'Error / Description', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-018', name: 'barcode_not_scanning',
    display_name: 'Item Not Found / Barcode Not Scanning',
    description: 'Item not found when scanning or barcode does not scan.',
    category: 'device', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'sku', display_name: 'Item SKU / Barcode', required: true, is_baseline: false },
      { field_name: 'device_type', display_name: 'Device Type', required: false, is_baseline: false, select_options: '["Sunmi", "Feitian"]' },
    ]
  },
  {
    sop_number: 'SOP-019', name: 'promo_voucher_not_working',
    display_name: 'Promo / Rewards Voucher Not Working',
    description: 'Promotional code or rewards voucher not applying or showing error.',
    category: 'promo', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'promo_code', display_name: 'Promo / Voucher Code', required: true, is_baseline: false },
      { field_name: 'error_message', display_name: 'Error Message', required: false, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-020', name: 'update_delivery_details',
    display_name: 'Update Delivery / Pickup Details After Order',
    description: 'Customer wants to change delivery address or pickup location after order placed.',
    category: 'delivery', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: true, is_baseline: false },
      { field_name: 'change_requested', display_name: 'What Needs to Change', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-021', name: 'tfg_accounts_rewards',
    display_name: 'TFG Accounts & Rewards / Staff Discount Card Linking',
    description: 'Issues with TFG account, rewards, or linking staff discount card.',
    category: 'account', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'account_type', display_name: 'Account Type', required: true, is_baseline: false, description: 'TFG Account, Rewards, or Staff Discount' },
      { field_name: 'error_message', display_name: 'Error / Description', required: false, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-022', name: 'wrong_item_delivered',
    display_name: 'Wrong Item Delivered',
    description: 'Store reporting on behalf of customer that wrong item was delivered.',
    category: 'delivery', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: true, is_baseline: false },
      { field_name: 'item_ordered', display_name: 'Item Ordered', required: true, is_baseline: false },
      { field_name: 'item_received', display_name: 'Item Received', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-023', name: 'damaged_item_received',
    display_name: 'Damaged Item Received',
    description: 'Store reporting on behalf of customer that item arrived damaged.',
    category: 'delivery', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: true, is_baseline: false },
      { field_name: 'item_description', display_name: 'Item Description', required: true, is_baseline: false },
      { field_name: 'damage_description', display_name: 'Damage Description', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-024', name: 'incentives_commission',
    display_name: 'Incentives & Commission Queries',
    description: 'Questions about BashStore or Omni+ incentives and commission.',
    category: 'account', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'query_type', display_name: 'Query Type', required: true, is_baseline: false, description: 'BashStore incentives, Omni+ commission, or other' },
    ]
  },
  {
    sop_number: 'SOP-025', name: 'payflex_instore',
    display_name: 'Payflex In-Store',
    description: 'Issues with Payflex payments, refunds, or what to tell customers about Payflex in-store.',
    category: 'payment', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: false, is_baseline: false },
      { field_name: 'issue_description', display_name: 'Issue Description', required: true, is_baseline: false },
    ]
  },
  {
    sop_number: 'SOP-026', name: 'post_sale_comms_missing',
    display_name: 'Post-Sale Comms Missing / Order Not on Profile',
    description: 'Customer not receiving order confirmations/tracking, or order not appearing on their profile.',
    category: 'order', build_status: 'handover_only', handover_trigger: 'always',
    fields: [
      { field_name: 'order_number', display_name: 'Order Number', required: true, is_baseline: false },
      { field_name: 'customer_email', display_name: 'Customer Email', required: false, is_baseline: false },
      { field_name: 'customer_phone', display_name: 'Customer Phone', required: false, is_baseline: false },
    ]
  },
];

module.exports = {
  config,
  guardrails,
  toneRules,
  baselineFields,
  fullScenarios,
  handoverOnlyScenarios,
  allScenarios: [...fullScenarios, ...handoverOnlyScenarios],
};
