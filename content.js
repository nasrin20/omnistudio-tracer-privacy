console.log("🔥 content.js loaded");

if (window.top !== window.self) {
  //console.log("⛔ iframe skipped");
} else {

  //console.log("✅ top window confirmed");

  /* ---------------------------
     Clear traces on refresh
  ----------------------------*/
  chrome.storage.session.set({ _pageLoaded: true }, () => {
    chrome.storage.local.set({ traces: [] });
    //console.log("🧹 OmniTracer cleared traces on page load");
  });

  /* ---------------------------
     Inject hook script
  ----------------------------*/
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");

  script.onload = () => console.log("✅ inject.js injected");
  script.onerror = (e) => console.error("❌ inject.js failed to load", e);

  document.documentElement.appendChild(script);

  /* ---------------------------
     Event listener
  ----------------------------*/
  document.documentElement.addEventListener("omni-tracer-event", () => {

    try {
      const raw = document.documentElement.getAttribute("data-omni-tracer");

      if (!raw) {
        //console.warn("⚠️ omni-tracer-event fired but no data attribute");
        return;
      }

      let data;

      try {
        data = JSON.parse(raw);
      } catch (e) {
        //console.error("❌ Failed to parse tracer JSON", raw);
        return;
      }

      /* ---------------------------
         NORMALIZE DATA
      ----------------------------*/

      const normalized = {
        id: crypto.randomUUID(),

        time: new Date(data.time).toLocaleTimeString(),

        durationMs: data.duration || 0,

        // 🔥 FIX → use inject type directly
        type: data.type || "Unknown",

        // 🔥 FIX → proper bundle fallback chain
        bundleName:
          data.bundleName ||
          data.name ||
          data.elementName ||
          "Unknown",

        apexClass: data.apexClass || "",
        apexMethod: data.apexMethod || "",

        request: data.request || {},
        response: data.response || {}
      };

      /* ---------------------------
         Store traces safely
      ----------------------------*/

      chrome.storage.local.get({ traces: [] }, (res) => {

        const existing = Array.isArray(res.traces) ? res.traces : [];

        chrome.storage.local.set({
          traces: [normalized, ...existing].slice(0, 100)
        });

      });

      //**console.log("📥 Trace received:", normalized);*///

    } catch (err) {
      /**console.error("❌ content.js unexpected error", err);*/
    }

  });

}
