document.addEventListener("DOMContentLoaded", () => {
  // --- Dynamic Style Injection to Shrink Containers & Gaps ---
  const style = document.createElement("style");
  style.textContent = `
    .dashboard-column {
        gap: 7px !important;
        max-height: none !important;
        overflow-y: visible !important;
    }

    .board-card {
        padding: 10px !important;
        font-size: 0.85rem !important;
    }

    .board-header {
        margin-bottom: 3px !important;
        border-bottom: none !important;
        padding-bottom: 0 !important;
        justify-content: flex-end !important;
    }

    .links-list {
        padding: 2px;
        gap: 0px !important;
        max-height: 575px !important;
        padding-right: 5px;
        padding-left: 10px;
        overflow-y: auto !important;
        scrollbar-color: rgba(255, 255, 255, 0.1) transparent !important;
    }

    .links-list::-webkit-scrollbar {
        width: 4px !important;
        background: transparent !important;
    }

    .links-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15) !important;
        border-radius: 4px !important;
    }

    .links-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3) !important;
    }

    .link-item {
        padding: 3px 1px 4px 1px !important;
        font-size: 0.85rem !important;
        height: auto !important;
        margin-bottom: 2px !important;
    }

    .link-item img {
        width: 14px !important;
        height: 14px !important;
    }
  `;
  document.head.appendChild(style);

  const storageGet = (defaults) =>
    new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
  const storageSet = (obj) =>
    new Promise((resolve) => chrome.storage.local.set(obj, resolve));

  const DEFAULT_SETTINGS = {
    columns: 5,
    accent: "#ffa64d",
    background: { type: "default", value: "" },
  };

  const dashboardGrid = document.getElementById("dashboard-grid");
  const emptyState = document.getElementById("empty-state");
  const spaceTabs = document.getElementById("space-tabs");
  const addSpaceBtn = document.getElementById("add-space-btn");
  const searchInput = document.getElementById("search-input");

  // Space Modal Elements
  const spaceModalOverlay = document.getElementById("space-modal-overlay");
  const spaceModalTitle = document.getElementById("space-modal-title");
  const spaceNameInput = document.getElementById("space-name-input");
  const closeSpaceModalBtn = document.getElementById("close-space-modal");
  const spaceForm = document.getElementById("space-form");

  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const closeModalBtn = document.getElementById("close-modal");
  const deleteItemBtn = document.getElementById("delete-item-btn");
  const contentForm = document.getElementById("content-form");
  const boardSelector = document.getElementById("board-selector");
  const linkTitleInput = document.getElementById("link-title");
  const linkUrlInput = document.getElementById("link-url");

  const settingsBtn = document.getElementById("settings-btn");
  const settingsOverlay = document.getElementById("settings-overlay");
  const closeSettingsBtn = document.getElementById("close-settings");
  const bgTypeSelect = document.getElementById("bg-type-select");
  const bgValueInput = document.getElementById("bg-value-input");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFileInput = document.getElementById("import-file-input");

  const contextMenu = document.getElementById("context-menu");
  const clockTime = document.getElementById("clock-time");
  const clockGreeting = document.getElementById("clock-greeting");

  // Confirm Dialog Modal Elements
  const confirmModalOverlay = document.getElementById("confirm-modal-overlay");
  const confirmModalTitle = document.getElementById("confirm-modal-title");
  const confirmModalMessage = document.getElementById("confirm-modal-message");
  const confirmOkBtn = document.getElementById("confirm-ok-btn");
  const confirmCancelBtn = document.getElementById("confirm-cancel-btn");

  let activeSpaceId = null;
  let editingLinkId = null;
  let spaceModalMode = "add";
  let targetRenameSpaceObj = null;
  let draggedType = null;
  let draggedEl = null;
  let searchTerm = "";

  if (importFileInput) {
    importFileInput.setAttribute("accept", ".json");
  }

  function showConfirmDialog({
    title = "Please confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    danger = true,
  } = {}) {
    return new Promise((resolve) => {
      if (!confirmModalOverlay) {
        resolve(true);
        return;
      }
      confirmModalTitle.textContent = title;
      confirmModalMessage.textContent = message;
      confirmOkBtn.textContent = confirmLabel;
      confirmOkBtn.className = danger ? "btn-danger" : "btn-primary";
      confirmModalOverlay.classList.remove("modal-hidden");

      const cleanup = (result) => {
        confirmModalOverlay.classList.add("modal-hidden");
        confirmOkBtn.removeEventListener("click", onOk);
        confirmCancelBtn.removeEventListener("click", onCancel);
        confirmModalOverlay.removeEventListener("click", onOverlay);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onOverlay = (e) => {
        if (e.target === confirmModalOverlay) cleanup(false);
      };

      confirmOkBtn.addEventListener("click", onOk);
      confirmCancelBtn.addEventListener("click", onCancel);
      confirmModalOverlay.addEventListener("click", onOverlay);
    });
  }

  function uid(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7)
    );
  }

  async function bootstrap() {
    let data = await storageGet({
      spaces: [],
      activeSpaceId: null,
      boards: [],
      bookmarks: [],
      settings: DEFAULT_SETTINGS,
    });

    if (!data.settings || data.settings.columns !== 5) {
      data.settings = { ...DEFAULT_SETTINGS, ...data.settings, columns: 5 };
      await storageSet({ settings: data.settings });
    }

    // Load from data.json if storage environment configuration is empty
    if (data.spaces.length === 0) {
      try {
        const response = await fetch("../data.json");
        const parsed = await response.json();

        if (
          parsed.exportType === "lumilist-bookmark-portability" &&
          Array.isArray(parsed.boards)
        ) {
          const finalBoards = [];
          const finalBookmarks = [];
          const spacesMap = new Map();

          if (Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
            parsed.spaces.forEach((s) =>
              spacesMap.set(s.name, { id: s.id, name: s.name }),
            );
          }

          if (!spacesMap.has("Home")) {
            spacesMap.set("Home", { id: "space_home", name: "Home" });
          }

          parsed.boards.forEach((boardData) => {
            const boardPos =
              typeof boardData.position === "number" ? boardData.position : 0;
            const columnLane =
              typeof boardData.column === "number" ? boardData.column : 0;
            const spaceName = boardData.spaceName || "Home";
            const currentSpace =
              spacesMap.get(spaceName) || spacesMap.get("Home");
            const generatedBoardId = boardData.id || uid("b");

            finalBoards.push({
              id: generatedBoardId,
              title: boardData.name || "",
              column: columnLane,
              order: boardPos,
              spaceId: currentSpace.id,
              pinned: false,
            });

            if (boardData.bookmarks && Array.isArray(boardData.bookmarks)) {
              boardData.bookmarks.forEach((bm) => {
                if (bm.url) {
                  finalBookmarks.push({
                    id: bm.id || uid("l"),
                    title: bm.title || "Untitled Link",
                    url: bm.url,
                    boardId: generatedBoardId,
                    order: typeof bm.position === "number" ? bm.position : 0,
                  });
                }
              });
            }
          });

          const finalSpaces = Array.from(spacesMap.values());
          data = {
            spaces: finalSpaces,
            activeSpaceId: finalSpaces[0].id,
            boards: finalBoards,
            bookmarks: finalBookmarks,
            settings: data.settings,
          };

          await storageSet(data);
        }
      } catch (err) {
        console.warn(
          "Could not load backup default setup from data.json, structural layout defaulting to empty.",
          err,
        );
        const homeId = "space_home";
        data.spaces = [{ id: homeId, name: "Home" }];
        data.activeSpaceId = homeId;
        data.boards = [
          {
            id: "b_1",
            title: "",
            column: 0,
            order: 0,
            spaceId: homeId,
            pinned: false,
          },
        ];
        await storageSet({
          spaces: data.spaces,
          activeSpaceId: data.activeSpaceId,
          boards: data.boards,
          bookmarks: [],
        });
      }
    }

    activeSpaceId = data.activeSpaceId || data.spaces[0].id;
    applySettings(data.settings);
    await renderSpaceTabs();
    await renderDashboard();
  }

  function applySettings(settings) {
    const s = { ...DEFAULT_SETTINGS, ...settings, columns: 5 };
    document.documentElement.style.setProperty(
      "--accent",
      s.accent || DEFAULT_SETTINGS.accent,
    );

    const bg = s.background || DEFAULT_SETTINGS.background;
    if (bg.type === "solid" && bg.value) {
      document.body.style.backgroundImage = "none";
      document.body.style.backgroundColor = bg.value;
    } else if (bg.type === "gradient" && bg.value) {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = bg.value;
    } else if (bg.type === "image" && bg.value) {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = `url("${bg.value}")`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage =
        "radial-gradient(at 90% 100%, rgba(45, 90, 68, 0.25) 0px, transparent 50%), radial-gradient(at 10% 0%, rgba(20, 40, 32, 0.4) 0px, transparent 60%), linear-gradient(135deg, rgba(16, 32, 26, 0.2) 0%, rgba(10, 16, 14, 0.5) 100%)";
    }

    if (bgTypeSelect) bgTypeSelect.value = bg.type || "default";
    if (bgValueInput) {
      bgValueInput.value = bg.value || "";
      bgValueInput.classList.toggle("hidden", bgTypeSelect.value === "default");
    }
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", async () => {
      const { settings } = await storageGet({ settings: DEFAULT_SETTINGS });
      applySettings(settings);
      settingsOverlay.classList.remove("modal-hidden");
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () =>
      settingsOverlay.classList.add("modal-hidden"),
    );
  }

  if (settingsOverlay) {
    settingsOverlay.addEventListener("click", (e) => {
      if (e.target === settingsOverlay)
        settingsOverlay.classList.add("modal-hidden");
    });
  }

  if (bgTypeSelect) {
    bgTypeSelect.addEventListener("change", () => {
      if (bgValueInput) {
        bgValueInput.classList.toggle(
          "hidden",
          bgTypeSelect.value === "default",
        );
      }
    });
  }

  async function saveBackgroundSetting() {
    const { settings } = await storageGet({ settings: DEFAULT_SETTINGS });
    const updated = {
      ...settings,
      columns: 5,
      background: {
        type: bgTypeSelect ? bgTypeSelect.value : "default",
        value: bgValueInput ? bgValueInput.value.trim() : "",
      },
    };
    await storageSet({ settings: updated });
    applySettings(updated);
  }

  if (bgTypeSelect)
    bgTypeSelect.addEventListener("change", saveBackgroundSetting);
  if (bgValueInput)
    bgValueInput.addEventListener("change", saveBackgroundSetting);

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      const data = await storageGet({ spaces: [], boards: [], bookmarks: [] });
      const portableData = {
        exportType: "lumilist-bookmark-portability",
        version: 4,
        generatedAt: new Date().toISOString(),
        spaces: data.spaces.map((s) => ({ id: s.id, name: s.name })),
        boards: [],
      };

      data.boards.forEach((board) => {
        const targetSpace = data.spaces.find((s) => s.id === board.spaceId);
        const boardLinks = data.bookmarks
          .filter((bm) => bm.boardId === board.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        portableData.boards.push({
          id: board.id,
          name: board.title || "",
          position: board.order || 0,
          column: typeof board.column === "number" ? board.column : 0,
          spaceId: board.spaceId,
          spaceName: targetSpace ? targetSpace.name : "Home",
          bookmarks: boardLinks.map((bm) => ({
            id: bm.id,
            title: bm.title,
            url: bm.url,
            position: bm.order || 0,
          })),
        });
      });

      const blob = new Blob([JSON.stringify(portableData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let date = new Date().toISOString().split("T")[0];
      date = date.substring(5);
      date = date.split("-");
      const downloadDate = date[1] + "_" + date[0];
      a.download = `bookmarks_${downloadDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (importBtn)
    importBtn.addEventListener("click", () => importFileInput.click());

  if (importFileInput) {
    importFileInput.addEventListener("change", () => {
      const file = importFileInput.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".json")) {
        alert("Invalid file format.");
        importFileInput.value = "";
        return;
      }

      if (settingsOverlay) settingsOverlay.classList.add("modal-hidden");

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (
            parsed.exportType === "lumilist-bookmark-portability" &&
            Array.isArray(parsed.boards)
          ) {
            const proceedImport = await showConfirmDialog({
              title: "Import Data",
              message: `Reconstruct dynamic setup layout settings?`,
              confirmLabel: "Import",
              danger: false,
            });

            if (!proceedImport) {
              importFileInput.value = "";
              return;
            }

            const spacesMap = new Map();
            const finalBoards = [];
            const finalBookmarks = [];

            if (Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
              parsed.spaces.forEach((s) => {
                spacesMap.set(s.name, {
                  id:
                    s.id === "space_home" || s.name === "Home"
                      ? "space_home"
                      : uid("space"),
                  name: s.name,
                });
              });
            }

            if (!spacesMap.has("Home")) {
              spacesMap.set("Home", { id: "space_home", name: "Home" });
            }

            parsed.boards.forEach((boardData) => {
              const boardPosition =
                typeof boardData.position === "number" ? boardData.position : 0;
              const columnLane =
                typeof boardData.column === "number"
                  ? boardData.column
                  : boardPosition % 5;
              const spaceName = boardData.spaceName || "Home";
              const currentSpace =
                spacesMap.get(spaceName) || spacesMap.get("Home");
              const generatedBoardId = uid("b");

              finalBoards.push({
                id: generatedBoardId,
                title: "",
                column: columnLane,
                order: boardPosition,
                spaceId: currentSpace.id,
                pinned: false,
              });

              if (boardData.bookmarks && Array.isArray(boardData.bookmarks)) {
                boardData.bookmarks.forEach((bm) => {
                  if (bm.url) {
                    finalBookmarks.push({
                      id: uid("l"),
                      title: bm.title || "Untitled Link",
                      url: bm.url,
                      boardId: generatedBoardId,
                      order: typeof bm.position === "number" ? bm.position : 0,
                    });
                  }
                });
              }
            });

            const finalSpaces = Array.from(spacesMap.values());

            await storageSet({
              spaces: finalSpaces,
              activeSpaceId: finalSpaces[0].id,
              boards: finalBoards,
              bookmarks: finalBookmarks,
              settings: { ...DEFAULT_SETTINGS, columns: 5 },
            });
            location.reload();
            return;
          }
        } catch (err) {
          alert("Backup parsing error: " + err.message);
        } finally {
          importFileInput.value = "";
        }
      };
      reader.readAsText(file);
    });
  }

  async function renderSpaceTabs() {
    const { spaces } = await storageGet({ spaces: [] });
    spaceTabs.querySelectorAll(".nav-btn").forEach((el) => el.remove());

    spaces.forEach((space) => {
      const btn = document.createElement("button");
      btn.className = "nav-btn" + (space.id === activeSpaceId ? " active" : "");
      btn.textContent = space.name;
      btn.dataset.spaceId = space.id;
      btn.addEventListener("click", async () => {
        activeSpaceId = space.id;
        await storageSet({ activeSpaceId });
        await renderSpaceTabs();
        await renderDashboard();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          {
            label: "Rename space",
            action: () => openSpaceModal("rename", space),
          },
          {
            label: "Delete space",
            danger: true,
            hidden: spaces.length <= 1,
            action: () => deleteSpace(space.id),
          },
        ]);
      });

      // Allow dragging a container onto a space tab to move it there
      btn.addEventListener("dragover", (e) => {
        if (draggedType !== "board") return;
        e.preventDefault();
        if (space.id !== activeSpaceId) btn.classList.add("drop-target");
      });
      btn.addEventListener("dragleave", () => {
        btn.classList.remove("drop-target");
      });
      btn.addEventListener("drop", async (e) => {
        e.preventDefault();
        btn.classList.remove("drop-target");
        if (draggedType !== "board" || !draggedEl) return;
        const boardId = draggedEl.dataset.boardId;
        const targetSpaceId = space.id;
        draggedEl.classList.remove("dragging");
        draggedType = null;
        draggedEl = null;
        if (boardId && targetSpaceId && targetSpaceId !== activeSpaceId) {
          await moveBoardToSpace(boardId, targetSpaceId);
        }
      });

      spaceTabs.insertBefore(btn, addSpaceBtn);
    });
  }

  function openSpaceModal(mode, spaceObj = null) {
    spaceModalMode = mode;
    targetRenameSpaceObj = spaceObj;
    spaceForm.reset();
    if (mode === "add") {
      spaceModalTitle.textContent = "New Space";
      spaceNameInput.value = "";
    } else {
      spaceModalTitle.textContent = "Rename Space";
      spaceNameInput.value = spaceObj.name;
    }
    spaceModalOverlay.classList.remove("modal-hidden");
    spaceNameInput.focus();
  }

  if (addSpaceBtn)
    addSpaceBtn.addEventListener("click", () => openSpaceModal("add"));
  if (closeSpaceModalBtn) {
    closeSpaceModalBtn.addEventListener("click", () =>
      spaceModalOverlay.classList.add("modal-hidden"),
    );
  }

  if (spaceForm) {
    spaceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = spaceNameInput.value.trim();
      if (!name) return;

      const { spaces } = await storageGet({ spaces: [] });

      if (spaceModalMode === "add") {
        const newSpace = { id: uid("space"), name };
        await storageSet({
          spaces: [...spaces, newSpace],
          activeSpaceId: newSpace.id,
        });
        activeSpaceId = newSpace.id;
      } else if (spaceModalMode === "rename" && targetRenameSpaceObj) {
        const updated = spaces.map((s) =>
          s.id === targetRenameSpaceObj.id ? { ...s, name } : s,
        );
        await storageSet({ spaces: updated });
      }

      spaceModalOverlay.classList.add("modal-hidden");
      await renderSpaceTabs();
      await renderDashboard();
    });
  }

  async function deleteSpace(spaceId) {
    const ok = await showConfirmDialog({
      title: "Delete Space",
      message: "Delete this space and all its containers?",
      confirmLabel: "Delete Space",
    });
    if (!ok) return;
    const data = await storageGet({ spaces: [], boards: [], bookmarks: [] });
    if (data.spaces.length <= 1) return;
    const remainingSpaces = data.spaces.filter((s) => s.id !== spaceId);
    const removedBoardIds = data.boards
      .filter((b) => b.spaceId === spaceId)
      .map((b) => b.id);
    const remainingBoards = data.boards.filter((b) => b.spaceId !== spaceId);
    const remainingBookmarks = data.bookmarks.filter(
      (bm) => !removedBoardIds.includes(bm.boardId),
    );
    activeSpaceId = remainingSpaces[0].id;
    await storageSet({
      spaces: remainingSpaces,
      boards: remainingBoards,
      bookmarks: remainingBookmarks,
      activeSpaceId,
    });
    await renderSpaceTabs();
    await renderDashboard();
  }

  async function moveBoardToSpace(boardId, targetSpaceId) {
    const data = await storageGet({ boards: [], bookmarks: [] });
    const board = data.boards.find((b) => b.id === boardId);
    if (!board || board.spaceId === targetSpaceId) return;

    const boardLinks = data.bookmarks.filter((bm) => bm.boardId === boardId);
    const targetSpaceBoards = data.boards.filter(
      (b) => b.spaceId === targetSpaceId,
    );
    const targetSpaceIsEmpty = targetSpaceBoards.length === 0;

    if (boardLinks.length === 1 && targetSpaceIsEmpty) {
      // Special case: the container only has a single link and the
      // destination space is completely empty. Instead of relocating the
      // old container as-is, paste its one link into a fresh container in
      // the new space and remove the old container entirely.
      const newBoard = {
        id: uid("b"),
        title: "",
        column: 0,
        order: 0,
        spaceId: targetSpaceId,
        pinned: false,
      };

      const updatedBoards = data.boards
        .filter((b) => b.id !== boardId)
        .concat(newBoard);

      const updatedBookmarks = data.bookmarks.map((bm) =>
        bm.id === boardLinks[0].id
          ? { ...bm, boardId: newBoard.id, order: 0 }
          : bm,
      );

      await storageSet({ boards: updatedBoards, bookmarks: updatedBookmarks });
    } else {
      // Regular case: move the whole container into the target space,
      // appending it to the end of its column lane there.
      const laneBoards = targetSpaceBoards.filter(
        (b) => (b.column || 0) === (board.column || 0),
      );
      const order = laneBoards.length
        ? Math.max(...laneBoards.map((b) => b.order || 0)) + 1
        : 0;

      const updatedBoards = data.boards.map((b) =>
        b.id === boardId ? { ...b, spaceId: targetSpaceId, order } : b,
      );

      await storageSet({ boards: updatedBoards });
    }

    await renderSpaceTabs();
    await renderDashboard();
  }

  async function openEditLinkModal(link) {
    editingLinkId = link.id;
    modalTitle.textContent = "Edit Link";
    deleteItemBtn.classList.remove("hidden");

    // if (boardSelector) {
    //   const { boards } = await storageGet({ boards: [] });
    //   const spaceBoards = boards.filter((b) => b.spaceId === activeSpaceId);
    //   boardSelector.innerHTML = "";
    //   spaceBoards.forEach((b, idx) => {
    //     const opt = document.createElement("option");
    //     opt.value = b.id;
    //     opt.textContent = `Container ${idx + 1}`;
    //     if (b.id === link.boardId) opt.selected = true;
    //     boardSelector.appendChild(opt);
    //   });
    // }
    if (linkTitleInput) linkTitleInput.value = link.title;
    if (linkUrlInput) linkUrlInput.value = link.url;

    modalOverlay.classList.remove("modal-hidden");
    if (linkTitleInput) linkTitleInput.focus();
  }

  function closeModal() {
    modalOverlay.classList.add("modal-hidden");
    editingLinkId = null;
    contentForm.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  if (deleteItemBtn) {
    deleteItemBtn.addEventListener("click", async () => {
      if (editingLinkId) {
        await deleteLink(editingLinkId);
      }
      closeModal();
    });
  }

  if (contentForm) {
    contentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = await storageGet({ bookmarks: [] });
      const title = linkTitleInput ? linkTitleInput.value.trim() : "";
      const url = linkUrlInput ? normalizeUrl(linkUrlInput.value.trim()) : "";

      // Preserve existing boardId when editing, or fallback to selector if available
      let boardId = boardSelector ? boardSelector.value : "";
      if (editingLinkId) {
        const existingLink = data.bookmarks.find(
          (bm) => bm.id === editingLinkId,
        );
        if (existingLink) {
          boardId = existingLink.boardId;
        }
      }

      if (!title || !url || !boardId) return;

      if (editingLinkId) {
        const updated = data.bookmarks.map((bm) =>
          bm.id === editingLinkId ? { ...bm, title, url, boardId } : bm,
        );
        await storageSet({ bookmarks: updated });
      }
      closeModal();
      await renderDashboard();
    });
  }

  function normalizeUrl(url) {
    if (!url) return url;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return "https://" + url;
    return url;
  }

  async function deleteBoard(id) {
    const data = await storageGet({ boards: [], bookmarks: [] });
    await storageSet({
      boards: data.boards.filter((b) => b.id !== id),
      bookmarks: data.bookmarks.filter((bm) => bm.boardId !== id),
    });
    await renderDashboard();
  }

  async function deleteLink(id) {
    const { bookmarks } = await storageGet({ bookmarks: [] });
    await storageSet({ bookmarks: bookmarks.filter((bm) => bm.id !== id) });
    await renderDashboard();
  }

  async function openAllLinks(boardId, bookmarks) {
    const links = bookmarks.filter((bm) => bm.boardId === boardId);
    if (links.length > 8) {
      const ok = await showConfirmDialog({
        title: "Open Multiple Tabs",
        message: `Open ${links.length} tabs?`,
        confirmLabel: "Open All",
        danger: false,
      });
      if (!ok) return;
    }
    links.forEach((l) => window.open(l.url, "_blank"));
  }

  function getFaviconUrl(pageUrl) {
    try {
      const url = new URL(pageUrl);
      return `https://www.google.com/s2/favicons?sz=64&domain=${url.hostname}`;
    } catch (e) {
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23788580'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E";
    }
  }

  async function renderDashboard() {
    const data = await storageGet({ boards: [], bookmarks: [] });
    const totalColumns = 5;
    const spaceBoards = data.boards.filter((b) => b.spaceId === activeSpaceId);
    const term = searchTerm.trim().toLowerCase();

    dashboardGrid.innerHTML = "";
    let anyBoards = spaceBoards.length > 0;

    for (let i = 0; i < totalColumns; i++) {
      const columnLane = document.createElement("div");
      const laneBoards = spaceBoards
        .filter((b) => (b.column || 0) === i)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      columnLane.className = `dashboard-column ${laneBoards.length === 0 ? "empty-lane" : ""}`;
      columnLane.dataset.column = i;

      laneBoards.forEach((board) => {
        const boardLinks = data.bookmarks
          .filter((bm) => bm.boardId === board.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        let visibleLinks = boardLinks;

        if (term) {
          visibleLinks = boardLinks.filter(
            (l) =>
              l.title.toLowerCase().includes(term) ||
              l.url.toLowerCase().includes(term),
          );
          if (visibleLinks.length === 0) return;
        }

        columnLane.appendChild(
          createBoardCard(board, boardLinks, visibleLinks, term),
        );
      });

      columnLane.appendChild(createPlaceholderElement(i));
      dashboardGrid.appendChild(columnLane);
    }
    emptyState.classList.toggle("hidden", anyBoards || term.length > 0);
  }

  function createBoardCard(board, allLinks, visibleLinks, term) {
    const boardCard = document.createElement("div");
    boardCard.className = "board-card";
    boardCard.draggable = true;
    boardCard.dataset.boardId = board.id;

    // 1. Links List View Context
    const linksList = document.createElement("div");
    linksList.className =
      "links-list" + (visibleLinks.length === 0 ? " links-empty" : "");
    linksList.dataset.boardId = board.id;

    if (visibleLinks.length === 0) {
      const hint = document.createElement("div");
      hint.className = "links-empty-hint";
      hint.textContent = term ? "No matching links" : "No links yet";
      linksList.appendChild(hint);
    }

    visibleLinks.forEach((link) => linksList.appendChild(createLinkItem(link)));
    boardCard.appendChild(linksList);

    // 2. Inline Card Modification Input Field Panel (Appended First)
    const inlineAddPanel = document.createElement("div");
    inlineAddPanel.className = "inline-add-panel hidden";

    const inlineInner = document.createElement("div");
    inlineInner.className = "inline-card-inner";
    inlineInner.innerHTML = `
      <input required type="text" class="inline-title-input" placeholder="Title" autocomplete="off" />
      <input required type="text" class="inline-url-input" placeholder="https://example.com" autocomplete="off" />
      <div class="inline-panel-actions">
        <button type="button" class="btn-inline-cancel">Cancel</button>
        <button type="button" class="btn-inline-save">Add Link</button>
      </div>
    `;
    inlineAddPanel.appendChild(inlineInner);

    const inlineTitleInput = inlineInner.querySelector(".inline-title-input");
    const inlineUrlInput = inlineInner.querySelector(".inline-url-input");
    const inlineSaveBtn = inlineInner.querySelector(".btn-inline-save");
    const inlineCancelBtn = inlineInner.querySelector(".btn-inline-cancel");

    const submitInlineLink = async () => {
      const rawUrl = inlineUrlInput.value.trim();
      let title = inlineTitleInput.value.trim();
      if (!rawUrl) return;

      const url = normalizeUrl(rawUrl);

      if (!title) {
        try {
          const domainMatch = url.replace(
            /^(?:https?:\/\/)?(?:www\.)?([^/]+)/i,
            "$1",
          );
          if (domainMatch) title = domainMatch.split(".")[0];
          title = title.charAt(0).toUpperCase() + title.slice(1);
        } catch (e) {
          title = rawUrl;
        }
      }

      const currentData = await storageGet({ bookmarks: [] });
      const boardLinks = currentData.bookmarks.filter(
        (bm) => bm.boardId === board.id,
      );
      const order = boardLinks.length
        ? Math.max(...boardLinks.map((bm) => bm.order || 0)) + 1
        : 0;

      const newLink = { id: uid("l"), title, url, boardId: board.id, order };
      await storageSet({ bookmarks: [...currentData.bookmarks, newLink] });

      inlineTitleInput.value = "";
      inlineUrlInput.value = "";
      inlineAddPanel.classList.add("hidden");
      await renderDashboard();
    };

    inlineTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitInlineLink();
    });
    inlineUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitInlineLink();
    });

    inlineSaveBtn.addEventListener("click", submitInlineLink);
    inlineCancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      inlineTitleInput.value = "";
      inlineUrlInput.value = "";
      inlineAddPanel.classList.add("hidden");
    });

    boardCard.appendChild(inlineAddPanel);

    // 3. Bottom Action Row Footer Container (Appended Last so it stays at the very bottom)
    const footerActions = document.createElement("div");
    footerActions.className = "board-footer-actions";

    const quickAddBtn = document.createElement("button");
    quickAddBtn.className = "icon-btn quick-add-action-btn";
    quickAddBtn.innerHTML = `
      <svg width="15" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    `;
    quickAddBtn.title = "Quick add link";
    quickAddBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = boardCard.querySelector(".inline-add-panel");
      if (panel) {
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden"))
          panel.querySelector(".inline-title-input").focus();
      }
    });
    footerActions.appendChild(quickAddBtn);

    const menuActionsBtn = document.createElement("button");
    menuActionsBtn.className = "icon-btn";
    menuActionsBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
      </svg>
    `;
    menuActionsBtn.title = "Container options";

    menuActionsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = menuActionsBtn.getBoundingClientRect();
      showContextMenu(rect.left, rect.bottom + window.scrollY, [
        {
          label: `Open All Links`,
          action: () => openAllLinks(board.id, allLinks),
          hidden: allLinks.length === 0,
        },
        {
          label: `Copy Data Layout`,
          action: () => {
            navigator.clipboard.writeText(JSON.stringify(allLinks, null, 2));
            alert("Container contents copied to clipboard.");
          },
        },
        { label: "", divider: true },
        {
          label: `Delete Container`,
          danger: true,
          action: async () => {
            const ok = await showConfirmDialog({
              title: "Delete Container",
              message: `Remove this link container completely?`,
              confirmLabel: "Delete Container",
            });
            if (ok) await deleteBoard(board.id);
          },
        },
      ]);
    });
    footerActions.appendChild(menuActionsBtn);
    boardCard.appendChild(footerActions);

    return boardCard;
  }

  function createLinkItem(link) {
    const itemRow = document.createElement("a");
    itemRow.className = "link-item";
    itemRow.href = link.url;
    itemRow.target = "_blank";
    itemRow.rel = "noopener noreferrer";
    itemRow.draggable = true;
    itemRow.dataset.linkId = link.id;

    const contentWrap = document.createElement("div");
    contentWrap.className = "link-content";

    const faviconImg = document.createElement("img");
    faviconImg.src = getFaviconUrl(link.url);

    const textSpan = document.createElement("span");
    textSpan.textContent = link.title;

    contentWrap.appendChild(faviconImg);
    contentWrap.appendChild(textSpan);
    itemRow.appendChild(contentWrap);

    const delLink = document.createElement("button");
    delLink.className = "delete-btn";
    delLink.textContent = "✕";
    delLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteLink(link.id);
    });
    itemRow.appendChild(delLink);

    itemRow.addEventListener("dblclick", (e) => {
      e.preventDefault();
      openEditLinkModal(link);
    });
    itemRow.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        {
          label: "↗️ Open in new tab",
          action: () => window.open(link.url, "_blank"),
        },
        {
          label: "📋 Copy link",
          action: () => navigator.clipboard.writeText(link.url),
        },
        { label: "✏️ Edit", action: () => openEditLinkModal(link) },
        { label: "", divider: true },
        { label: "🗑️ Delete", danger: true, action: () => deleteLink(link.id) },
      ]);
    });

    return itemRow;
  }

  function createPlaceholderElement(columnIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "placeholder-container";

    const btn = document.createElement("div");
    btn.className = "add-board-placeholder";
    btn.innerHTML = `<i class="fa-solid fa-plus"></i> ADD CONTAINER`;

    btn.addEventListener("click", async () => {
      const data = await storageGet({ boards: [] });
      const laneBoards = data.boards.filter(
        (b) => b.spaceId === activeSpaceId && b.column === columnIndex,
      );
      const order = laneBoards.length
        ? Math.max(...laneBoards.map((b) => b.order || 0)) + 1
        : 0;

      const newBoard = {
        id: uid("b"),
        title: "",
        column: columnIndex,
        order,
        spaceId: activeSpaceId,
        pinned: false,
      };

      await storageSet({ boards: [...data.boards, newBoard] });
      await renderDashboard();
    });

    wrapper.appendChild(btn);
    return wrapper;
  }

  function getDragAfterElement(container, y, selector) {
    const els = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null },
    ).element;
  }

  dashboardGrid.addEventListener("dragstart", (e) => {
    const linkItem = e.target.closest(".link-item");
    const boardCard = e.target.closest(".board-card");
    if (linkItem) {
      draggedType = "link";
      draggedEl = linkItem;
      linkItem.classList.add("dragging");
    } else if (boardCard) {
      draggedType = "board";
      draggedEl = boardCard;
      boardCard.classList.add("dragging");
    }
  });

  dashboardGrid.addEventListener("dragover", (e) => {
    if (!draggedType) return;
    e.preventDefault();

    if (draggedType === "board") {
      const column = e.target.closest(".dashboard-column");
      if (!column) return;
      const after = getDragAfterElement(column, e.clientY, ".board-card");
      const placeholder = column.querySelector(".placeholder-container");
      if (after == null) column.insertBefore(draggedEl, placeholder);
      else column.insertBefore(draggedEl, after);
    } else if (draggedType === "link") {
      const list = e.target.closest(".links-list");
      if (!list) return;
      const after = getDragAfterElement(list, e.clientY, ".link-item");
      if (after == null) list.appendChild(draggedEl);
      else list.insertBefore(draggedEl, after);
    }
  });

  dashboardGrid.addEventListener("dragend", async () => {
    if (draggedType === "board" && draggedEl) {
      draggedEl.classList.remove("dragging");
      await persistBoardOrder();
    } else if (draggedType === "link" && draggedEl) {
      draggedEl.classList.remove("dragging");
      await persistLinkOrder();
    }
    draggedType = null;
    draggedEl = null;
  });

  async function persistBoardOrder() {
    const { boards } = await storageGet({ boards: [] });
    const boardsById = new Map(boards.map((b) => [b.id, b]));
    const columns = dashboardGrid.querySelectorAll(".dashboard-column");
    columns.forEach((col, colIndex) => {
      const cards = col.querySelectorAll(".board-card");
      cards.forEach((card, order) => {
        const b = boardsById.get(card.dataset.boardId);
        if (b) {
          b.column = colIndex;
          b.order = order;
        }
      });
    });
    await storageSet({ boards: Array.from(boardsById.values()) });
    await renderDashboard();
  }

  async function persistLinkOrder() {
    const { bookmarks } = await storageGet({ bookmarks: [] });
    const linksById = new Map(bookmarks.map((l) => [l.id, l]));
    const lists = dashboardGrid.querySelectorAll(".links-list");
    lists.forEach((list) => {
      const boardId = list.dataset.boardId;
      const items = list.querySelectorAll(".link-item");
      items.forEach((item, order) => {
        const l = linksById.get(item.dataset.linkId);
        if (l) {
          l.boardId = boardId;
          l.order = order;
        }
      });
    });
    await storageSet({ bookmarks: Array.from(linksById.values()) });
    await renderDashboard();
  }

  function showContextMenu(x, y, items) {
    contextMenu.innerHTML = "";
    items
      .filter((it) => !it.hidden)
      .forEach((it) => {
        const li = document.createElement("li");
        if (it.divider) {
          li.className = "menu-divider";
          contextMenu.appendChild(li);
          return;
        }
        li.innerHTML = it.label;
        if (it.danger) li.classList.add("danger");
        li.addEventListener("click", () => {
          hideContextMenu();
          if (it.action) it.action();
        });
        contextMenu.appendChild(li);
      });

    contextMenu.classList.remove("hidden");
    const menuWidth = 190;
    const menuHeight = contextMenu.offsetHeight || 200;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);
    contextMenu.style.left = `${clampedX}px`;
    contextMenu.style.top = `${clampedY}px`;
  }

  function hideContextMenu() {
    contextMenu.classList.add("hidden");
  }
  document.addEventListener("click", (e) => {
    if (!contextMenu.contains(e.target)) hideContextMenu();
  });
  window.addEventListener("scroll", hideContextMenu, true);

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchTerm = searchInput.value;
        renderDashboard();
      }, 100);
    });
  }

  function updateClock() {
    if (!clockTime || !clockGreeting) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    clockTime.textContent = `${hours}:${minutes} ${ampm}`;
    const h = now.getHours();
    clockGreeting.textContent =
      h < 5
        ? "Late night"
        : h < 12
          ? "Good morning"
          : h < 17
            ? "Good afternoon"
            : h < 21
              ? "Good evening"
              : "Good night";
  }
  updateClock();
  setInterval(updateClock, 15000);

  document.addEventListener("keydown", (e) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement.tagName,
    );
    if (e.key === "Escape") {
      if (modalOverlay && !modalOverlay.classList.contains("modal-hidden"))
        closeModal();
      if (
        settingsOverlay &&
        !settingsOverlay.classList.contains("modal-hidden")
      )
        settingsOverlay.classList.add("modal-hidden");
      if (
        spaceModalOverlay &&
        !spaceModalOverlay.classList.contains("modal-hidden")
      )
        spaceModalOverlay.classList.add("modal-hidden");
      if (
        confirmModalOverlay &&
        !confirmModalOverlay.classList.contains("modal-hidden")
      )
        confirmModalOverlay.classList.add("modal-hidden");
      hideContextMenu();
      if (isTyping) document.activeElement.blur();
      return;
    }
    if (!isTyping && e.key === "/" && searchInput) {
      e.preventDefault();
      searchInput.focus();
      return;
    }
  });

  bootstrap();
});
