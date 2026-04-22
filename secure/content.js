function getUserSelectedText() {
  return window.getSelection()?.toString().trim() || "";
}

window.addEventListener("message", (event) => {
  // Defensive filtering for any window message handlers.
  if (event.origin !== window.location.origin) return;
  if (!event.data || typeof event.data !== "object") return;

  // The secure version intentionally does not expose history or summary APIs here.
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_SELECTED_TEXT") return false;

  const selected = getUserSelectedText();
  if (!selected) {
    sendResponse({
      ok: false,
      error: "No text selected. Highlight text first."
    });
    return false;
  }

  sendResponse({ ok: true, text: selected });
  return false;
});
