const HISTORY_KEY = "summaryHistory";

/* ═══════════════════════════════════════════════════════════════════
   DEFENSE: Sensitive-Content Sanitizer (Defense-in-Depth for Attack 2)
   ──────────────────────────────────────────────────────────────────
   Even though the secure extension only summarizes user-selected text,
   a user might accidentally select sensitive data.  This layer
   automatically detects and redacts common sensitive patterns before
   the summary is stored in history.
   ═══════════════════════════════════════════════════════════════════ */

const SENSITIVE_PATTERNS = [
  // Social Security Numbers  (123-45-6789, 123 45 6789, 123456789)
  { regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,       label: "[SSN REDACTED]" },

  // Credit / debit card numbers  (16-digit, with optional spaces/dashes)
  { regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,            label: "[CARD# REDACTED]" },

  // API keys / secret keys  (sk_live_..., sk_test_..., ak_..., etc.)
  { regex: /\b(sk|ak|pk)_(live|test|prod)_[A-Za-z0-9]{16,}\b/g,
                                                        label: "[API-KEY REDACTED]" },

  // Session IDs  (sess_...)
  { regex: /\bsess_[A-Za-z0-9\-]{8,}\b/g,             label: "[SESSION REDACTED]" },

  // Bearer / auth tokens
  { regex: /\b(Bearer\s+)[A-Za-z0-9\-_.~+\/]{20,}/gi, label: "[AUTH-TOKEN REDACTED]" },

  // CSRF tokens  (long hex/base64 strings preceded by "csrf" or "token")
  { regex: /\b(csrf[_\-]?token\s*[:=]\s*)[A-Za-z0-9+\/=]{16,}/gi,
                                                        label: "$1[CSRF REDACTED]" },

  // Generic tokens  (tok_...)
  { regex: /\btok_[A-Za-z0-9_]{8,}\b/g,               label: "[TOKEN REDACTED]" },

  // Passwords appearing as "password = ..." or "password: ..."
  { regex: /(password\s*[:=]\s*)(\S+)/gi,              label: "$1[PASSWORD REDACTED]" },

  // Email addresses
  { regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z]{2,}\b/gi,
                                                        label: "[EMAIL REDACTED]" },

  // Routing numbers (9 digits preceded by "routing")
  { regex: /(routing\s*#?\s*[:=]?\s*)\d{9}\b/gi,      label: "$1[ROUTING# REDACTED]" },

  // Account numbers (common patterns like ####-####-####)
  { regex: /\b\d{4}-\d{4}-\d{4}\b/g,                  label: "[ACCT# REDACTED]" },

  // Dollar amounts over $1,000 (financial data)
  { regex: /\$\d{1,3}(,\d{3})+(\.\d{2})?/g,           label: "[AMOUNT REDACTED]" }
];

/**
 * Scan text for sensitive patterns and replace them with safe labels.
 * Returns { sanitized, redactedCount }.
 */
function sanitizeSensitiveContent(text) {
  let sanitized = text;
  let redactedCount = 0;

  for (const { regex, label } of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    const before = sanitized;
    sanitized = sanitized.replace(regex, (...args) => {
      redactedCount++;
      // If label uses backreferences ($1), handle via replacement string
      return label;
    });
  }

  return { sanitized, redactedCount };
}


/* ═══════════════════════════════════════════════════════════════════
   Core summarization (unchanged logic, but now runs sanitizer)
   ═══════════════════════════════════════════════════════════════════ */

function summarizeText(rawText) {
  // 1. Sanitize before summarizing
  const { sanitized, redactedCount } = sanitizeSensitiveContent(rawText);

  const compact = sanitized.replace(/\s+/g, " ").trim();
  if (!compact) return "No content found to summarize.";

  const maxLen = 320;
  let summary = compact.length <= maxLen ? compact : `${compact.slice(0, maxLen)}...`;

  // 2. Append redaction notice if anything was filtered
  if (redactedCount > 0) {
    summary += `\n\n⚠ ${redactedCount} sensitive value(s) were automatically redacted.`;
  }

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
