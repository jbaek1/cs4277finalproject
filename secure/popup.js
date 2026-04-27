async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function formatHistory(history) {
  if (!history.length) return "No history yet.";
  return history
    .map(
      (entry, idx) =>
        `${idx + 1}. ${entry.createdAt}\nURL: ${entry.url}\n${entry.summary}`
    )
    .join("\n\n");
}

/* ═══════════════════════════════════════════════════════════════════
   Get selected text — tries the content script first, then falls
   back to chrome.scripting.executeScript if the content script
   isn't available (e.g. tab loaded before the extension).
   ═══════════════════════════════════════════════════════════════════ */
async function getSelectedText(tabId) {
  // Attempt 1: Ask the content script (which caches the selection).
  try {
    const res = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "GET_SELECTED_TEXT" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null); // content script not available
        } else {
          resolve(response);
        }
      });
    });
    if (res?.ok) return res;
    if (res && !res.ok) return res; // pass through the error message
  } catch (_) {
    // fall through to fallback
  }

  // Attempt 2: Direct script injection (works even without content script).
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString().trim() || ""
    });
    if (result) return { ok: true, text: result };
    return { ok: false, error: "No text selected. Highlight text on the page first." };
  } catch (err) {
    return { ok: false, error: `Cannot access this page: ${err.message}` };
  }
}

document.getElementById("summarizeBtn").addEventListener("click", async () => {
  const output = document.getElementById("output");
  const tab = await getActiveTab();
  if (!tab?.id) {
    output.textContent = "No active tab found.";
    return;
  }

  output.textContent = "Reading selection…";

  const selectionRes = await getSelectedText(tab.id);
  if (!selectionRes?.ok) {
    output.textContent = selectionRes?.error || "Could not read selected text.";
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "SUMMARIZE_SELECTED_TEXT",
      payload: { text: selectionRes.text, url: tab.url }
    },
    (summaryRes) => {
      output.textContent = summaryRes?.ok
        ? summaryRes.summary
        : `Failed: ${summaryRes?.error || "Unknown error"}`;
    }
  );
});

document.getElementById("historyBtn").addEventListener("click", () => {
  const historyBox = document.getElementById("history");
  chrome.runtime.sendMessage({ type: "GET_HISTORY_FOR_POPUP" }, (response) => {
    if (!response?.ok) {
      historyBox.textContent = `Failed: ${response?.error || "Unknown error"}`;
      return;
    }
    historyBox.textContent = formatHistory(response.history || []);
  });
});
