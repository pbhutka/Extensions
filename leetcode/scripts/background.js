// Merged background service worker.
// Section 1: "Leetcode Snippets" — seeds default snippets + serves get-active/get-snippets.
// Section 2: "LeetCode Companies" — fetches + caches the GitHub company->problem map.

// --- Section 1: Snippets --------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ active: true });

  const res = await chrome.storage.local.get("snippets");

  if (!res.snippets) {
    try {
      const response = await fetch(chrome.runtime.getURL("/json/snippets.json"));
      const defaultSnippets = await response.json();
      await chrome.storage.local.set({ snippets: defaultSnippets });
    } catch (error) {
      console.error("Failed to load default snippets from snippets.json:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.event === "get-active" || message.event === "get-snippets") {
    chrome.storage.local.get(["active", "snippets"]).then(sendResponse);
    return true;
  }
});

// --- Section 2: Company tags ----------------------------------------------
const GITHUB_REPO_OWNER = "liquidslr";
const GITHUB_REPO_NAME = "leetcode-company-wise-problems";
const CACHE_KEY = "leetcode_company_map";
const CACHE_TIME_KEY = "leetcode_company_map_timestamp";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function extractProblemSlugsFromCSV(csvText) {
  // IMPORTANT: These "All.csv" files do NOT have a header row - every
  // single line is a data row shaped like:
  //   MEDIUM,Two Sum,100.0,0.47,https://leetcode.com/problems/two-sum,"Array, Hash Table"
  // (Difficulty, Title, Frequency, AcceptanceRate, Link, Topics)
  //
  // Rather than relying on a fixed column index (fragile if the column
  // order ever changes upstream, and the quoted Topics column can itself
  // contain commas which breaks naive line.split(",")), we just scan the
  // raw text for every "leetcode.com/problems/<slug>" occurrence. This
  // is robust to formatting quirks and doesn't require a header at all.
  const slugs = new Set();
  const linkRegex = /leetcode\.com\/problems\/([a-zA-Z0-9-]+)/gi;
  let match;
  while ((match = linkRegex.exec(csvText)) !== null) {
    slugs.add(match[1].toLowerCase());
  }

  return Array.from(slugs);
}

async function fetchAndBuildCompanyMap() {
  try {
    console.log("[LeetCode Extension] Fetching GitHub repos directory...");
    const contentsUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/`;
    const response = await fetch(contentsUrl);

    if (!response.ok) {
      throw new Error(`GitHub API HTTP ${response.status}`);
    }

    const items = await response.json();
    const companyFolders = items.filter(
      (item) => item.type === "dir" && !item.name.startsWith("."),
    );

    const companyMap = {};

    // The repo stores the "all-time" list per company as a file literally
    // named "5. All.csv" (numeric prefix + space), not "All.csv". That
    // mismatch was the main reason the map came back empty - every fetch
    // below was 404ing and silently returning early. Keep a couple of
    // filename candidates so we degrade gracefully if the repo's naming
    // ever shifts again, instead of failing completely.
    const CSV_FILENAME_CANDIDATES = ["5. All.csv", "All.csv"];

    const fetchPromises = companyFolders.map(async (folder) => {
      const companyName = folder.name;
      const encodedCompanyName = encodeURIComponent(companyName);

      try {
        let csvText = null;

        for (const filename of CSV_FILENAME_CANDIDATES) {
          const rawCsvUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/${encodedCompanyName}/${encodeURIComponent(filename)}`;
          const csvRes = await fetch(rawCsvUrl);
          if (csvRes.ok) {
            csvText = await csvRes.text();
            break;
          }
        }

        if (!csvText) {
          console.warn(`[LeetCode Extension] No CSV found for ${companyName}`);
          return;
        }

        const problemSlugs = extractProblemSlugsFromCSV(csvText);

        problemSlugs.forEach((slug) => {
          if (!companyMap[slug]) {
            companyMap[slug] = [];
          }
          if (!companyMap[slug].includes(companyName)) {
            companyMap[slug].push(companyName);
          }
        });
      } catch (err) {
        console.warn(
          `[LeetCode Extension] Failed CSV fetch for ${companyName}`,
          err,
        );
      }
    });

    await Promise.all(fetchPromises);

    await chrome.storage.local.set({
      [CACHE_KEY]: companyMap,
      [CACHE_TIME_KEY]: Date.now(),
    });

    console.log("[LeetCode Extension] Cache updated successfully.");
    return companyMap;
  } catch (error) {
    console.error("[LeetCode Extension] Error fetching repositories:", error);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCompanyMap") {
    chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY], async (result) => {
      const cachedMap = result[CACHE_KEY];
      const timestamp = result[CACHE_TIME_KEY];

      if (cachedMap && timestamp && Date.now() - timestamp < ONE_DAY_MS) {
        sendResponse({ companyMap: cachedMap });
      } else {
        const updatedMap = await fetchAndBuildCompanyMap();
        sendResponse({ companyMap: updatedMap || cachedMap || {} });
      }
    });
    return true;
  }
});
