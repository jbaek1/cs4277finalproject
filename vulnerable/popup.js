async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function askContentScript(tabId, type) {
  return chrome.tabs.sendMessage(tabId, { type });
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

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const visible = document.body?.innerText || "";
      const hiddenValues = Array.from(
        document.querySelectorAll("input, textarea")
      ).map((el) => `${el.name || el.id || "field"}=${el.value || ""}`);
      return [visible, hiddenValues.join("\n")].join("\n").trim();
    }
  });

  chrome.runtime.sendMessage(
    { type: "SUMMARIZE_FROM_CONTENT", payload: { text: result } },
    (response) => {
      output.textContent = response?.ok
        ? response.summary
        : `Failed: ${response?.error || "Unknown error"}`;
    }
  );
});

document.getElementById("historyBtn").addEventListener("click", async () => {
  const historyBox = document.getElementById("history");
  chrome.runtime.sendMessage({ type: "GET_HISTORY_FOR_POPUP" }, (response) => {
    if (!response?.ok) {
      historyBox.textContent = `Failed: ${response?.error || "Unknown error"}`;
      return;
    }
    historyBox.textContent = formatHistory(response.history || []);
  });
});
