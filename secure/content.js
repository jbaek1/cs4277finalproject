/* ═══════════════════════════════════════════════════════════════════
   Secure Content Script
   ──────────────────────
   Caches the user's text selection so it survives the focus shift
   that occurs when the extension popup opens.
   ═══════════════════════════════════════════════════════════════════ */

// Cache the last non-empty selection so it persists when the popup steals focus.
let cachedSelection = "";

function updateCachedSelection() {
  const sel = window.getSelection()?.toString().trim() || "";
  if (sel) cachedSelection = sel;
}

// Capture selection on every mouse-up and keyboard-based selection change.
document.addEventListener("mouseup", updateCachedSelection);
document.addEventListener("selectionchange", updateCachedSelection);

function getUserSelectedText() {
  // Try live selection first; fall back to cached.
  const live = window.getSelection()?.toString().trim() || "";
  return live || cachedSelection;
}

/* ── Defensive window.postMessage handler (blocks cross-origin) ── */
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (!event.data || typeof event.data !== "object") return;
  // The secure version intentionally does not expose history or summary APIs here.
});

/* ── Extension message handler ── */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_SELECTED_TEXT") return false;

  const selected = getUserSelectedText();
  if (!selected) {
    sendResponse({
      ok: false,
      error: "No text selected. Highlight text on the page first."
    });
    return false;
  }

  sendResponse({ ok: true, text: selected });
  // Clear cache after successful read so stale selections aren't reused.
  cachedSelection = "";
  return false;
});
