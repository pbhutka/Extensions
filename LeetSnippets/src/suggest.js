// src/suggest.js
// Injected into the page (same way as initialize.js / enable.js / disable.js).
// Adds a Monaco completion provider that suggests identifiers (variables and
// functions) already present in the current editor buffer — independent of
// LeetBoost's snippet-expansion feature, so it works whether AutoCorrect is
// on or off.

(function () {
  if (window.__leetBoostSuggestInstalled) return;
  window.__leetBoostSuggestInstalled = true;

  const LOG = (...args) => console.log("[LeetBoost:suggest]", ...args);

  const RESERVED = new Set([
    // JS / TS
    "var",
    "let",
    "const",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "break",
    "continue",
    "class",
    "new",
    "this",
    "true",
    "false",
    "null",
    "undefined",
    "typeof",
    "instanceof",
    "try",
    "catch",
    "finally",
    "throw",
    "switch",
    "case",
    "default",
    "import",
    "export",
    "from",
    "async",
    "await",
    "yield",
    "void",
    "in",
    "of",
    "extends",
    "super",
    "static",
    "get",
    "set",
    "interface",
    "type",
    "implements",
    // Python
    "def",
    "self",
    "pass",
    "lambda",
    "None",
    "True",
    "False",
    "elif",
    "not",
    "and",
    "or",
    "is",
    "with",
    "global",
    "nonlocal",
    "assert",
    "del",
    "raise",
    "except",
    "print",
    // C / C++ / Java / general
    "int",
    "long",
    "short",
    "double",
    "float",
    "char",
    "bool",
    "string",
    "String",
    "public",
    "private",
    "protected",
    "final",
    "virtual",
    "override",
    "namespace",
    "using",
    "include",
    "template",
    "typename",
    "auto",
    "struct",
    "nullptr",
    "package",
    "vector",
    "list",
    "map",
    "set",
    "unordered_map",
    "unordered_set",
    "pair",
  ]);

  const FUNC_PATTERNS = [
    /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, // Python
    /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g, // JS named function
    /\b(?:int|long|short|double|float|char|bool|void|auto|string|String|vector<[^>]*>|List<[^>]*>)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, // C/C++/Java return-type functions
  ];

  function extractIdentifiers(text) {
    const funcs = new Set();
    const vars = new Set();

    FUNC_PATTERNS.forEach((re) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (name && !RESERVED.has(name)) funcs.add(name);
      }
    });

    const generic = text.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || [];
    generic.forEach((tok) => {
      if (tok.length > 1 && !RESERVED.has(tok) && !funcs.has(tok)) {
        vars.add(tok);
      }
    });

    return { vars, funcs };
  }

  function makeProvider(monaco) {
    return {
      triggerCharacters: [],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const typed = word.word; // text already typed for the current token

        // No partial word under the cursor (e.g. right after a space or
        // symbol) — don't show anything unprompted.
        if (!typed || typed.length === 0) {
          return { suggestions: [], incomplete: false };
        }

        const text = model.getValue();
        const { vars, funcs } = extractIdentifiers(text);
        const typedLower = typed.toLowerCase();

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = [];

        funcs.forEach((name) => {
          if (name.toLowerCase() === typedLower) return; // skip exact self-match
          if (!name.toLowerCase().startsWith(typedLower)) return;
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: name,
            detail: "LeetBoost · function in file",
            sortText: "0" + name,
            range,
          });
        });

        vars.forEach((name) => {
          if (name.toLowerCase() === typedLower) return;
          if (!name.toLowerCase().startsWith(typedLower)) return;
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: name,
            detail: "LeetBoost · used in file",
            sortText: "1" + name,
            range,
          });
        });

        // Nothing matched what was typed — return empty so no box appears.
        return { suggestions, incomplete: false };
      },
    };
  }

  function registerLanguages(monaco, provider, registeredSet) {
    // Register for every language id any currently-open model actually uses,
    // instead of guessing fixed ids like "python" vs "python3".
    const models = monaco.editor.getModels();
    const liveIds = new Set(models.map((m) => m.getLanguageId()));

    // Common fallback ids in case no model exists yet at registration time.
    [
      "javascript",
      "typescript",
      "python",
      "python3",
      "java",
      "cpp",
      "c",
      "csharp",
      "cs",
      "go",
      "golang",
      "rust",
      "kotlin",
      "swift",
      "php",
      "ruby",
      "scala",
    ].forEach((id) => liveIds.add(id));

    liveIds.forEach((id) => {
      if (registeredSet.has(id)) return;
      registeredSet.add(id);
      monaco.languages.registerCompletionItemProvider(id, provider);
      LOG("registered completion provider for language:", id);
    });
  }

  function waitForMonaco(attemptsLeft) {
    if (window.monaco && window.monaco.languages && window.monaco.editor) {
      LOG("window.monaco found, setting up provider");
      const monaco = window.monaco;
      const provider = makeProvider(monaco);
      const registeredSet = new Set();

      registerLanguages(monaco, provider, registeredSet);

      // If the user switches language (LeetCode creates a new model / changes
      // the model's language), re-scan periodically to catch new ids.
      setInterval(
        () => registerLanguages(monaco, provider, registeredSet),
        3000,
      );
      return;
    }
    if (attemptsLeft <= 0) {
      console.warn(
        "LeetBoost: window.monaco not found after ~10s — variable/function suggestions disabled. " +
          "This LeetCode build may not expose monaco globally; see chat for next steps.",
      );
      return;
    }
    setTimeout(() => waitForMonaco(attemptsLeft - 1), 250);
  }

  waitForMonaco(40); // retries for up to ~10s while the editor mounts
})();
