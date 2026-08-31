if (window.monaco && window.monaco.editor) {
  const editors = window.monaco.editor.getEditors();
  if (editors.length > 0) {
    editors[0].updateOptions({
      suggestOnTriggerCharacters: false,
      quickSuggestions: false,
      parameterHints: { enabled: false },
    });
  }
}
