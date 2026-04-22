// Attack 2: intentionally over-collects page content, including sensitive fields.
function collectEntireDomText() {
  const visible = document.body?.innerText || "";
  const hiddenValues = Array.from(
    document.querySelectorAll("input, textarea")
  ).map((el) => `${el.name || el.id || "field"}=${el.value || ""}`);

  return [visible, hiddenValues.join("\n")].join("\n").trim();
}

function requestSummaryFromBackground(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "SUMMARIZE_FROM_CONTENT", payload: { text } },
      (response) => resolve(response)
    );
  });
}

window.addEventListener("message", async (event) => {
  // Attack 1: intentionally accepts messages from any origin.
  if (event.data?.type === "GET_HISTORY") {
    chrome.runtime.sendMessage({ type: "GET_HISTORY_FOR_POPUP" }, (response) => {
      window.postMessage(
        {
          type: "HISTORY_RESPONSE",
          history: response?.history || [],
          ok: Boolean(response?.ok)
        },
        "*"
      );
    });
  }

  if (event.data?.type === "SUMMARIZE_PAGE") {
    const allText = collectEntireDomText();
    const response = await requestSummaryFromBackground(allText);
    window.postMessage({ type: "SUMMARY_RESPONSE", response }, "*");
  }
});
