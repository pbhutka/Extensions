document.addEventListener("DOMContentLoaded", function () {
  const DOT_COLORS = [
    "var(--rank-green)",
    "var(--rank-cyan)",
    "var(--rank-blue)",
    "var(--rank-purple)",
    "var(--rank-orange)",
    "var(--rank-red)",
  ];

  chrome.storage.local.get(
    ["userHandles", "extensionEnabled"],
    function (result) {
      let storageHandles = result.userHandles || [];
      let extensionEnabled =
        result.extensionEnabled !== undefined ? result.extensionEnabled : true;

      const toggle = document.getElementById("extension-toggle");
      if (toggle) {
        toggle.checked = extensionEnabled;
        updateBackground(extensionEnabled);

        toggle.addEventListener("change", function () {
          chrome.storage.local.set({ extensionEnabled: this.checked });
          updateBackground(this.checked);
        });
      }

      loadLocalDataJson(storageHandles);
    },
  );

  function loadLocalDataJson(existingStorageHandles) {
    const dataUrl = chrome.runtime.getURL("data.json");

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Could not find data.json");
        return response.json();
      })
      .then((fileHandles) => {
        if (Array.isArray(fileHandles)) {
          let mergedHandles = Array.from(
            new Set([...existingStorageHandles, ...fileHandles]),
          );
          chrome.storage.local.set({ userHandles: mergedHandles }, function () {
            renderTable(mergedHandles);
          });
        } else {
          renderTable(existingStorageHandles);
        }
      })
      .catch((err) => {
        console.log(
          "Reading data.json failed or file missing, rendering storage:",
          err,
        );
        renderTable(existingStorageHandles);
      });
  }

  function updateBackground(enabled) {
    const container = document.querySelector(".container");
    if (container) {
      container.style.background = enabled ? "#000000" : "#5f5f5f";
    }
  }

  function renderTable(listValues) {
    const tableBody = document.getElementById("table-body");
    tableBody.innerHTML = "";

    listValues.forEach((value, index) => {
      const row = tableBody.insertRow();
      const valueCell = row.insertCell();
      const actionCell = row.insertCell();

      const handleCell = document.createElement("div");
      handleCell.className = "handle-cell";

      const colorDot = document.createElement("span");
      colorDot.className = "rank-dot";
      colorDot.style.background = DOT_COLORS[index % DOT_COLORS.length];

      const nameSpan = document.createElement("span");
      nameSpan.textContent = value;

      handleCell.appendChild(colorDot);
      handleCell.appendChild(nameSpan);
      valueCell.appendChild(handleCell);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteButton.onclick = function () {
        chrome.storage.local.get("userHandles", function (result) {
          let userHandles = result.userHandles || [];
          const handleIndex = userHandles.indexOf(value);
          if (handleIndex !== -1) {
            userHandles.splice(handleIndex, 1);
            chrome.storage.local.set({ userHandles: userHandles }, function () {
              renderTable(userHandles);
            });
          }
        });
      };

      actionCell.className = "text-right";
      actionCell.appendChild(deleteButton);
    });
  }

  function handleAddUser() {
    var userHandleInput = document.getElementById("userHandle");
    var userHandle = userHandleInput.value;
    var errorMessage = document.getElementById("errorMessage");

    if (userHandle.trim() === "") {
      errorMessage.style.color = "var(--rank-red)";
      errorMessage.textContent = "Please enter the Codeforces handle!";
      return;
    }

    chrome.storage.local.get("userHandles", function (result) {
      let userHandles = result.userHandles || [];
      if (userHandles.indexOf(userHandle) === -1) {
        userHandles.push(userHandle);
        chrome.storage.local.set({ userHandles: userHandles }, function () {
          renderTable(userHandles);
          errorMessage.textContent = "Handle Saved Successfully!";
          errorMessage.style.color = "var(--rank-green)";
          userHandleInput.value = "";
        });
      } else {
        errorMessage.style.color = "var(--rank-red)";
        errorMessage.textContent = "Handle already exists!";
      }
    });
  }

  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      handleAddUser();
    });
  }

  var buttonElement = document.getElementById("btn-save");
  if (buttonElement) {
    buttonElement.addEventListener("click", handleAddUser);
  }

  var exportBtn = document.getElementById("btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      chrome.storage.local.get("userHandles", function (result) {
        let userHandles = result.userHandles || [];
        let blob = new Blob([JSON.stringify(userHandles, null, 2)], {
          type: "application/json",
        });
        let url = URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = "friends.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }
});
