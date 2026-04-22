const HISTORY_KEY = "summaryHistory";

function renderEntries(history) {
  const container = document.getElementById("entries");
  const status = document.getElementById("status");

  if (!history.length) {
    container.innerHTML = "";
    status.textContent = "No summaries stored yet.";
    return;
  }

  status.textContent = `${history.length} entr${history.length === 1 ? "y" : "ies"} stored.`;
  container.innerHTML = history
    .map(
      (entry, idx) => `
      <div class="entry">
        <div class="entry-meta">#${idx + 1} &mdash; ${entry.createdAt}</div>
        <div class="entry-url">${entry.url}</div>
        <div class="entry-summary">${entry.summary}</div>
      </div>`
    )
    .join("");
}

function loadHistory() {
  chrome.storage.local.get(HISTORY_KEY, (data) => {
    const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    renderEntries(history);
  });
}

document.getElementById("refreshBtn").addEventListener("click", loadHistory);

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("Clear all summary history?")) return;
  chrome.storage.local.remove(HISTORY_KEY, () => {
    renderEntries([]);
  });
});

loadHistory();
