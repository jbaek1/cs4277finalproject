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
  if (message?.type === "SUMMARIZE_FROM_CONTENT") {
    const summary = summarizeText(message.payload?.text ?? "");
    const entry = {
      url: sender.tab?.url || "unknown",
      createdAt: new Date().toISOString(),
      summary
    };
    saveHistoryEntry(entry)
      .then(() => sendResponse({ ok: true, summary }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === "GET_HISTORY_FOR_POPUP") {
    getHistory()
      .then((history) => sendResponse({ ok: true, history }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});
