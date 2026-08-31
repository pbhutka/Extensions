(function () {
  "use strict";

  function applyDarkSelect(select) {
    select.style.setProperty("background-color", "#000", "important");
    select.style.setProperty("color", "#fff", "important");
    select.style.setProperty("color-scheme", "dark", "important");

    for (const option of select.options) {
      option.style.setProperty("background-color", "#000", "important");
      option.style.setProperty("color", "#fff", "important");
    }
  }

  function scan() {
    document.querySelectorAll("select").forEach(applyDarkSelect);
  }

  scan();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        if (node.matches?.("select")) {
          applyDarkSelect(node);
        }

        node.querySelectorAll?.("select").forEach(applyDarkSelect);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches?.("select")) {
      applyDarkSelect(event.target);
    }
  });
})();
