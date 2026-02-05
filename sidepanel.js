let allTraces = [];
let selectedTrace = null;
let currentTab = "request";
let currentFilter = "All";

/* ==============================
   Render Trace List
============================== */

function renderList(filter = "All") {
  currentFilter = filter;

  const list = document.getElementById("list");
  if (!list) return;

  //list.innerHTML = "";
  list.replaceChildren();

  allTraces
    .filter(t => filter === "All" || t.type === filter)
    .forEach(t => {

      const displayName = getDisplayName(t);

      const div = document.createElement("div");

      div.className = `trace ${t.type === "DataRaptor" ? "dr" : "ip"}`;

      div.textContent =
        `${t.type === "DataRaptor" ? "DR" : "IP"} - ` +
        `${t.durationMs ?? 0}ms - ` +
        `${displayName}`;

      div.onclick = () => selectTrace(t);

      list.appendChild(div);
    });
}

/* ==============================
   Naming Helper
============================== */

function getDisplayName(trace) {

  if (trace.bundleName) return trace.bundleName;

  if (trace.request?.Bundle) return trace.request.Bundle;

  if (trace.request?.integrationProcedureKey)
    return trace.request.integrationProcedureKey;

  if (trace.elementName) return trace.elementName;

  return "Unknown";
}

/* ==============================
   Select Trace
============================== */

function selectTrace(trace) {
  selectedTrace = trace;
  renderJson();
}

/* ==============================
   Render JSON Viewer
============================== */

function renderJson() {
  if (!selectedTrace) return;

  let data =
    currentTab === "request"
      ? selectedTrace.request
      : parseOmniResponse(selectedTrace.response);

  const jsonEl = document.getElementById("json");
  if (!jsonEl) return;

  jsonEl.textContent = JSON.stringify(data, null, 2);
}

/* ==============================
   Omni Response Parser
============================== */

function parseOmniResponse(resp) {

  if (!resp) return {};

  // Already object
  if (typeof resp === "object") {

    // Integration Procedure / DR wrapper
     if (resp.returnValue !== undefined) {
      return unwrapReturnValue(resp.returnValue);
    }

    return unwrapReturnValue(resp);
  }

  return unwrapReturnValue(resp);
}

/* ==============================
   Multi-layer Omni unwrap
============================== */

function unwrapReturnValue(value) {
 let parsed = value;

  // Omni sometimes triple nests JSON
  for (let i = 0; i < 5; i++) {

    if (typeof parsed !== "string") break;

    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }

  // Special handling for OBDRresp wrapper
/*  if (parsed?.OBDRresp) {
    return parsed.OBDRresp;
  }*/

  /* -----------------------------
     DataRaptor unwrap
  ------------------------------*/

  if (parsed?.OBDRresp !== undefined) {
    return parsed.OBDRresp;
  }

  /* -----------------------------
     Integration Procedure unwrap
  ------------------------------*/

  if (parsed?.IPResult !== undefined) {
    return parsed.IPResult;
  }
  return parsed;
}

/* ==============================
   Clear Storage
============================== */

function clearTraces() {
  chrome.storage.local.set({ traces: [] }, () => {
    allTraces = [];
    selectedTrace = null;

    document.getElementById("list")?.replaceChildren();
    document.getElementById("json")?.replaceChildren();
  });
}

/* ==============================
   Storage Listener
============================== */

/*chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.traces) {
    allTraces = changes.traces.newValue || [];
    renderList(currentFilter);
  }
});*/
chrome.storage.onChanged.addListener((changes, area) => {

  if (area !== "local" || !changes.traces) return;

  const previousSelectedId = selectedTrace?.id;

  allTraces = changes.traces.newValue || [];

  renderList(currentFilter);

  /* Restore selected trace if exists */
  if (previousSelectedId) {
    const found = allTraces.find(t => t.id === previousSelectedId);
    if (found) {
      selectedTrace = found;
      renderJson();
    }
  }

  /* Auto scroll newest trace into view */
  const list = document.getElementById("list");
  if (list?.firstChild) {
    list.firstChild.scrollIntoView({ behavior: "smooth" });
  }

});


/* ==============================
   DOM Ready Init
============================== */

document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.local.get({ traces: [] }, res => {
    allTraces = res.traces || [];
    renderList();
  });

  document.querySelectorAll("#filters button").forEach(btn => {
    btn.onclick = () => renderList(btn.dataset.type);
  });

  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      renderJson();
    };
  });

  document.getElementById("clear")?.addEventListener("click", clearTraces);
});
