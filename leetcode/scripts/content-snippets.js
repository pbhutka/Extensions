// From "Leetcode Snippets" — bridges the page's Monaco instance to the
// injected /src scripts for snippet autocomplete + identifier suggestions.
(function () {
  let leetBoostActive = false;
  let editorReady = false;

  function injectScript(scriptName) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(scriptName);
    document.documentElement.appendChild(script);
    script.onload = () => script.remove();
  }

  function postSnippetsToInjectedScript(snippets) {
    window.postMessage(
      { from: "content-script", type: "set-snippets", snippets },
      "*",
    );
  }

  async function enableAutoCorrect() {
    const res = await chrome.runtime.sendMessage({ event: "get-snippets" });
    postSnippetsToInjectedScript(res.snippets || []);
    injectScript("src/enable.js");
    leetBoostActive = true;
  }

  function disableAutoCorrect() {
    injectScript("src/disable.js");
    leetBoostActive = false;
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (
      event.data &&
      event.data.from === "injected-script" &&
      event.data.type === "editor-ready"
    ) {
      const res = await chrome.runtime.sendMessage({ event: "get-active" });
      leetBoostActive = res.active;
      if (res.active) enableAutoCorrect();
      editorReady = true;
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.event === "refresh-snippets") {
      if (leetBoostActive) postSnippetsToInjectedScript(message.snippets);
    } else if (message.event === "refresh-active") {
      if (editorReady) {
        if (message.active) enableAutoCorrect();
        else disableAutoCorrect();
      }
    }
  });

  injectScript("src/initialize.js");

  // Variable/function-name suggestions — runs independently of the
  // AutoCorrect toggle, since it's a separate feature from snippet expansion.
  injectScript("src/suggest.js");
})();
