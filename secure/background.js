const HISTORY_KEY = "summaryHistory";

/*
 * ── PATCH: Sensitive-element filtering (Attack 2 mitigation) ────────────────
 *
 * sanitizeSensitiveData() scrubs common sensitive patterns from any text
 * before it is stored or summarized. This is a last-resort defense-in-depth
 * layer that runs in the background worker, complementing the primary patch
 * (selection-only input in content.js / popup.js).
 *
 * Patterns redacted:
 *   • JWT / Bearer tokens          • SSNs  (###-##-####)
 *   • Credit / debit card numbers  • CSRF / session / API token key-value pairs
 *   • Bank routing & account nums  • Hex secret IDs (32+ hex chars)
 *   • Email addresses              • Passwords / pins embedded in key=value text
 * ─────────────────────────────────────────────────────────────────────────── */
const SENSITIVE_PATTERNS = [
  // JWT tokens (three base64url segments)
  { re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: "[JWT_REDACTED]" },
  // SSN  ###-##-####
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, label: "[SSN_REDACTED]" },
  // Credit / debit card  (4 groups of 4 digits, optional dashes/spaces)
  { re: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, label: "[CARD_REDACTED]" },
  // Routing numbers (9-digit, standalone)
  { re: /\b0[2-9]\d{7}\b/g, label: "[ROUTING_REDACTED]" },
  // CSRF, session, auth, pin, otp, secret key=value pairs
  { re: /(?:csrf|session|token|auth|api[_-]?key|pin|otp|secret|wire_tok)[=:\s]+[\w.\-]{6,}/gi, label: "[TOKEN_REDACTED]" },
  // Password key=value pairs
  { re: /(?:password|passwd|pwd)[=:\s]+\S+/gi, label: "[PASSWORD_REDACTED]" },
  // 32+ hex character secrets (SHA-like IDs, internal tokens)
  { re: /\b[0-9a-f]{32,}\b/gi, label: "[HEX_SECRET_REDACTED]" },
  // Email addresses
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: "[EMAIL_REDACTED]" }
];

function sanitizeSensitiveData(text) {
  let sanitized = text;
  for (const { re, label } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(re, label);
  }
  return sanitized;
}

function summarizeText(rawText) {
  const sanitized = sanitizeSensitiveData(rawText);
  const compact = sanitized.replace(/\s+/g, " ").trim();
  if (!compact) return "No content found to summarize.";

  const maxLen = 320;
  const summary = compact.length <= maxLen ? compact : `${compact.slice(0, maxLen)}...`;
  return summary;
}


/* ═══════════════════════════════════════════════════════════════════
   Storage helpers
   ═══════════════════════════════════════════════════════════════════ */

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

async function saveHistoryEntry(entry) {
  const history = await getHistory();
  history.unshift(entry);
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, 100) });
}


/* ═══════════════════════════════════════════════════════════════════
   Message handler
   ═══════════════════════════════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Patch: only SUMMARIZE_SELECTED_TEXT is accepted — no full-DOM path exists.
  if (message?.type === "SUMMARIZE_SELECTED_TEXT") {
    const text = message.payload?.text ?? "";
    const summary = summarizeText(text);
    const entry = {
      url: message.payload?.url || sender.tab?.url || "unknown",
      createdAt: new Date().toISOString(),
      summary
    };
    saveHistoryEntry(entry)
      .then(() => sendResponse({ ok: true, summary }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  // Only extension UI should access history.
  if (message?.type === "GET_HISTORY_FOR_POPUP" && !sender.tab) {
    getHistory()
      .then((history) => sendResponse({ ok: true, history }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  sendResponse({ ok: false, error: "Unauthorized or unknown message." });
  return false;
});
