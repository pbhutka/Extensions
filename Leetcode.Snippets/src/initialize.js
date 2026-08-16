let itemProvider;

const editorReadyInterval = setInterval(() => {
  const textarea = document.querySelector("#editor textarea");
  if (textarea && textarea === document.activeElement) {
    clearInterval(editorReadyInterval);

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (
        event.data.from === "content-script" &&
        event.data.type === "set-snippets"
      ) {
        makeItems(event.data.snippets);
      }
    });

    window.postMessage({ from: "injected-script", type: "editor-ready" }, "*");
  }
}, 100);

function makeItems(snippets) {
  if (itemProvider) itemProvider.dispose();
  if (window.monaco && window.monaco.languages) {
    itemProvider = window.monaco.languages.registerCompletionItemProvider("*", {
      provideCompletionItems: () => {
        const suggestions = snippets.map((snippet) => ({
          label: snippet.trigger,
          kind: window.monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.snippet,
          insertTextRules:
            window.monaco.languages.CompletionItemInsertTextRule
              .InsertAsSnippet,
          sortText: "0000",
        }));
        return { suggestions };
      },
    });
  }
}
