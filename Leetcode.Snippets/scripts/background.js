chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ active: true });

  const res = await chrome.storage.local.get("snippets");

  if (!res.snippets) {
    try {
      const response = await fetch(chrome.runtime.getURL("/json/snippets.json"));
      const defaultSnippets = await response.json();
      await chrome.storage.local.set({ snippets: defaultSnippets });
    } catch (error) {
      console.error("Failed to load default snippets from snippets.json:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.event === "get-active" || message.event === "get-snippets") {
    chrome.storage.local.get(["active", "snippets"]).then(sendResponse);
    return true;
  }
});
