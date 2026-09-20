// From "LeetCode Companies" — injects company-tag badges under the problem title.
(function () {
let currentSlug = "";

function removeLeetCodeCompanies() {
  document.querySelectorAll("div").forEach((div) => {
    if (div.textContent.trim() === "Companies") {
      div.remove();
    }
  });
}
// Extract actual problem slug ignoring /description, /solutions, /submissions, etc.
function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
  if (!match) return null;

  const rawSlug = match[1].toLowerCase();

  // Guard against accidental sub-route capture
  const subRoutes = [
    "",
    "description",
    "solutions",
    "submissions",
    "editorial",
    "discussion",
  ];

  if (subRoutes.includes(rawSlug)) return null;

  return rawSlug;
}

function injectCompanyTags(companies) {
  // Target problem title element across LeetCode versions
  const titleElement =
    document.querySelector('div[data-cy="question-title"]') ||
    document.querySelector("h1") ||
    document.querySelector(".text-title-large") ||
    document.querySelector('a[href*="/problems/"]');

  if (!titleElement) {
    return false;
  }

  // Target the immediate wrapper parent of the title
  const parent = titleElement.closest("div") || titleElement.parentNode;
  if (!parent) return false;

  let container = document.getElementById("lc-custom-company-tags");

  // If container already exists in DOM, ensure it stays attached
  if (container) {
    if (!parent.contains(container)) {
      parent.insertBefore(container, titleElement.nextSibling);
    }

    return true;
  }

  // Create container
  container = document.createElement("div");
  container.id = "lc-custom-company-tags";
  container.className = "lc-company-tags-wrapper";

  const INITIAL_VISIBLE_COUNT = 3;

  if (companies && companies.length > 0) {
    companies.forEach((company, index) => {
      const badge = document.createElement("span");
      badge.className = "lc-company-badge";

      if (index >= INITIAL_VISIBLE_COUNT) {
        badge.classList.add("lc-company-badge-extra");
      }

      badge.innerText = company;
      container.appendChild(badge);
    });

    const remaining = companies.length - INITIAL_VISIBLE_COUNT;

    if (remaining > 0) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "lc-company-toggle";
      // toggleBtn.innerText = `+${remaining} more`;

      // toggleBtn.addEventListener("click", () => {
      //   const expanded = container.classList.toggle("lc-expanded");

      //   toggleBtn.innerText = expanded ? "Show less" : `+${remaining} more`;
      // });
      toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path class="gyxsqc" />
</svg>
`;

      toggleBtn.addEventListener("click", () => {
        const expanded = container.classList.toggle("lc-expanded");

        toggleBtn.innerHTML = expanded
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path class="ybqt-k" />
</svg>
`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path class="gyxsqc" />
</svg>
`;
      });

      container.appendChild(toggleBtn);
    }
  } else {
    const noData = document.createElement("span");
    noData.className = "lc-company-none";
    noData.innerText = "No company data found";
    container.appendChild(noData);
  }

  parent.insertBefore(container, titleElement.nextSibling);

  return true;
}

function processCurrentPage() {
  const slug = getProblemSlug();
  if (!slug) return;
  removeLeetCodeCompanies();

  if (slug !== currentSlug) {
    currentSlug = slug;

    const existing = document.getElementById("lc-custom-company-tags");

    if (existing) {
      existing.remove();
    }
  }

  chrome.runtime.sendMessage({ action: "getCompanyMap" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.companyMap) {
      return;
    }

    const companyMap = response.companyMap;
    const companies = companyMap[slug] || [];

    // Poll until DOM mounts the problem title component
    let attempts = 0;

    const interval = setInterval(() => {
      attempts++;

      const success = injectCompanyTags(companies);

      if (success || attempts > 30) {
        clearInterval(interval);
      }
    }, 300);
  });
}

// Continuous DOM Observer to handle dynamic sub-route changes
// (/description, /solutions)
let lastUrl = location.href;

const observer = new MutationObserver(() => {
  const url = location.href;
  const slug = getProblemSlug();

  // Trigger re-check on URL change or missing injected container
  if (
    url !== lastUrl ||
    (slug && !document.getElementById("lc-custom-company-tags"))
  ) {
    lastUrl = url;
    processCurrentPage();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial run
processCurrentPage();

// Prevent copying text from the injected company tags
document.addEventListener("copy", (event) => {
  const selection = window.getSelection();
  const node = selection?.anchorNode;

  if (node) {
    const element =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

    if (element?.closest("#lc-custom-company-tags")) {
      event.preventDefault();
    }
  }
});
})();
