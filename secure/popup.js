async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
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

document.getElementById("summarizeBtn").addEventListener("click", async () => {
  const output = document.getElementById("output");
  const tabId = await getActiveTabId();
  if (!tabId) {
    output.textContent = "No active tab found.";
    return;
  }

  chrome.tabs.sendMessage(tabId, { type: "GET_SELECTED_TEXT" }, (selectionRes) => {
    if (!selectionRes?.ok) {
      output.textContent = selectionRes?.error || "Could not read selected text.";
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "SUMMARIZE_SELECTED_TEXT",
        payload: { text: selectionRes.text }
      },
      (summaryRes) => {
        output.textContent = summaryRes?.ok
          ? summaryRes.summary
          : `Failed: ${summaryRes?.error || "Unknown error"}`;
      }
    );
  });
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
