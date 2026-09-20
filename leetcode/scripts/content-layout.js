// From "Leet Y2020" — forces the main container to full width.
(function () {
  function applyClassicFixes() {
    const mainContainer = document.querySelector("#__next > div");
    if (mainContainer) {
      mainContainer.style.maxWidth = "100%";
    }
  }

  const observer = new MutationObserver(() => {
    applyClassicFixes();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  applyClassicFixes();
})();
