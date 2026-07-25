function applyTheme() {
    document.documentElement.style.setProperty(
        "--leetcode-editor-bg",
        "#282c34"
    );

    const observer = new MutationObserver(() => {
        const editor = document.querySelector(".monaco-editor");

        if (!editor) return;

        editor.style.background = "#282c34";

        document.querySelectorAll(".margin").forEach(el => {
            el.style.background = "#282c34";
        });

        document.querySelectorAll(".monaco-editor-background").forEach(el => {
            el.style.background = "#282c34";
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

applyTheme();