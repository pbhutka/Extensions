let snippets = [];
let editIndex = null;

const mainView = document.getElementById("main-view");
const editorView = document.getElementById("editor-view");
const snippetContainer = document.getElementById("snippet-container");
const activeSwitch = document.getElementById("active-switch");

const triggerInput = document.getElementById("trigger-input");
const snippetInput = document.getElementById("snippet-input");
const errorDiv = document.getElementById("error");

document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get(["snippets", "active"]);
  snippets = data.snippets || [];
  activeSwitch.checked = data.active !== false;

  renderSnippets();
});

function renderSnippets() {
  snippetContainer.innerHTML = "";
  if (!snippets.length) {
    snippetContainer.innerHTML =
      "<p style='text-align:center;'>No Snippets Available</p>";
    return;
  }

  snippets.forEach((item) => {
    const card = document.createElement("div");
    card.className = "snippet-card";
    card.innerHTML = `
      <div class="snippet-top">
        <span class="trigger"><b>${item.trigger}</b></span>
        <div class="actions">
          <button class="copy-btn" title="Copy snippet"><i class="fa-solid fa-copy"></i></button>
          <button class="edit-btn" title="Edit snippet"><i class="fa-solid fa-pen"></i></button>
          <button class="del-btn" title="Delete snippet"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
      <code>${item.snippet}</code>
    `;

    card.querySelector(".copy-btn").onclick = (e) => copySnippet(item.snippet, e.currentTarget);
    card.querySelector(".edit-btn").onclick = () => openEditor(item.trigger);
    card.querySelector(".del-btn").onclick = () => deleteSnippet(item.trigger);

    snippetContainer.appendChild(card);
  });
}

async function copySnippet(text, btnElement) {
  try {
    await navigator.clipboard.writeText(text);
    const icon = btnElement.querySelector("i");
    icon.className = "fa-solid fa-check";
    btnElement.classList.add("copied");
    setTimeout(() => {
      icon.className = "fa-solid fa-copy";
      btnElement.classList.remove("copied");
    }, 1200);
  } catch (err) {
    console.error("Failed to copy snippet: ", err);
  }
}

function openEditor(trigger = null) {
  editIndex = trigger;
  errorDiv.innerText = "";

  if (trigger) {
    document.getElementById("editor-title").innerText = "Edit Snippet";
    const item = snippets.find((s) => s.trigger === trigger);
    triggerInput.value = item.trigger;
    snippetInput.value = item.snippet;
  } else {
    document.getElementById("editor-title").innerText = "Add Snippet";
    triggerInput.value = "";
    snippetInput.value = "";
  }

  mainView.classList.add("hidden");
  editorView.classList.remove("hidden");
}

function closeEditor() {
  mainView.classList.remove("hidden");
  editorView.classList.add("hidden");
}

document.getElementById("add-btn").onclick = () => openEditor();
document.getElementById("discard-btn").onclick = closeEditor;

document.getElementById("save-btn").onclick = () => {
  const trig = triggerInput.value.trim();
  const snip = snippetInput.value;

  if (!trig) return (errorDiv.innerText = "Trigger word required");
  if (!snip) return (errorDiv.innerText = "Code snippet required");

  const exists = snippets.some(
    (s) => s.trigger === trig && s.trigger !== editIndex,
  );
  if (exists) return (errorDiv.innerText = "Trigger already exists");

  if (editIndex) {
    snippets = snippets.filter((s) => s.trigger !== editIndex);
  }

  snippets.push({ trigger: trig, snippet: snip });
  saveAndBroadcast();
  closeEditor();
};

activeSwitch.onchange = () => {
  const active = activeSwitch.checked;
  chrome.storage.local.set({ active });
  broadcastMessage({ event: "refresh-active", active });
};

function deleteSnippet(trigger) {
  snippets = snippets.filter((s) => s.trigger !== trigger);
  saveAndBroadcast();
}

function saveAndBroadcast() {
  chrome.storage.local.set({ snippets });
  renderSnippets();
  broadcastMessage({ event: "refresh-snippets", snippets });
}

function broadcastMessage(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (
        tab.url &&
        (tab.url.includes("/problems/") || tab.url.includes("/contest/"))
      ) {
        chrome.tabs.sendMessage(tab.id, msg, () => chrome.runtime.lastError);
      }
    });
  });
}
