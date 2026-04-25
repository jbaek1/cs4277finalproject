const HISTORY_KEY = "summaryHistory";

function summarizeText(rawText) {
  const compact = rawText.replace(/\s+/g, " ").trim();
  if (!compact) return "No content found to summarize.";
  const maxLen = 320;
  return compact.length <= maxLen ? compact : `${compact.slice(0, maxLen)}...`;
}

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

async function saveHistoryEntry(entry) {
  const history = await getHistory();
  history.unshift(entry);
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, 100) });
}

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
