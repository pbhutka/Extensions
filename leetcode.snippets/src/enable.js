if (window.monaco && window.monaco.editor) {
  const editors = window.monaco.editor.getEditors();
  if (editors.length > 0) {
    editors[0].updateOptions({
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
    });
  }
}
