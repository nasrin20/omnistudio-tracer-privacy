(function OmniTracerAuraXHR() {
  //console.log("✅ OmniTracer inject active");

  const OriginalXHR = window.XMLHttpRequest;

  const seenCircular = new WeakSet();

  /* ----------------------------- */
  function safeParse(json) {
    try { return JSON.parse(json); }
    catch { return null; }
  }

  function safeFingerprint(obj) {
  try {
    return JSON.stringify(obj, (k, v) => {
      if (typeof v === "function") return undefined;
      if (v === undefined) return undefined;
      return v;
    });
  } catch {
    return crypto.randomUUID();
  }
}

  /* ----------------------------- */
 function parseAuraResponse(responseText) {

  const json = safeParse(responseText);
  if (!json) return null;

  const action = json.actions?.[0];
  if (!action) return null;

  if (action.state !== "SUCCESS") {
    return { error: action.error || "Unknown Error" };
  }

  let value = action.returnValue;

  /* unwrap nested returnValue / string JSON */
  for (let i = 0; i < 10; i++) {

    if (!value) break;

    if (typeof value === "string") {
      const parsed = safeParse(value);
      if (!parsed) break;
      value = parsed;
      continue;
    }

    if (typeof value === "object" && value.returnValue !== undefined) {
      value = value.returnValue;
      continue;
    }

    break;
  }

  /* Normalize DR */
  if (value?.OBDRresp !== undefined) {
    return value.OBDRresp;
  }

  /* Normalize IP */
  if (value?.IPResult !== undefined) {
    return value.IPResult;
  }

  return value;
}


  /* ----------------------------- */
  function parseOmniAction(messageJson) {

    const action = messageJson.actions?.[0];
    if (!action) return null;

    const inner = action.params?.params;
    if (!inner) return null;

    const input = safeParse(inner.input) || {};
    const options = safeParse(inner.options) || {};
    const methodName = inner?.sMethodName || "";

    /* DataRaptor */
    if (
      inner.sMethodName === "invokeOutboundDR" ||
      inner.sClassName?.includes("DROmniScriptIntegration")
    ) {
      return {
        type: "DataRaptor",
        name: input.Bundle || input.elementName,
        omniScriptId: input.omniScriptId,
        elementName: input.elementName,
        request: input.DRParams || {},
        rawInput: input,
        rawOptions: options
      };
    }

    /* Integration Procedure */
    if (inner.sClassName?.includes("IPService")) {
      return {
        type: "IntegrationProcedure",
        name: methodName || input.Bundle || input.elementName || "Unknown IP",
        omniScriptId: input.omniScriptId,
        elementName: input.elementName,
        request: input,
        rawInput: input,
        rawOptions: options
      };
    }

    return null;
  }

  /* ----------------------------- */
  window.XMLHttpRequest = function () {

    const xhr = new OriginalXHR();
    let requestUrl = "";
    let requestBody = "";
    const start = performance.now();

    const open = xhr.open;
    xhr.open = function (method, url) {
      requestUrl = url;
      return open.apply(this, arguments);
    };

    const send = xhr.send;
    xhr.send = function (body) {

      requestBody = body;

      xhr.addEventListener("loadend", function () {

        try {

          if (typeof requestUrl !== "string" || !requestUrl.includes("/aura"))
            return;

          let message = null;

          if (typeof requestBody === "string") {
            const params = new URLSearchParams(requestBody);
            message = params.get("message");
          }

          else if (requestBody instanceof FormData) {
            message = requestBody.get("message");
          }

          if (typeof message !== "string" || !message.trim()) return;

          const parsedMessage = safeParse(message);
          if (!parsedMessage) return;

          const parsed = parseOmniAction(parsedMessage);
          if (!parsed) return;

          
          const response = parseAuraResponse(xhr.responseText);

          const payload = {
            id: crypto.randomUUID(),
            time: Date.now(),
            duration: Math.round(performance.now() - start),

            type: parsed.type,
            bundleName: parsed.name || "Unknown",

            omniScriptId: parsed.omniScriptId,
            elementName: parsed.elementName,

            request: parsed.request,
            response
          };

          document.documentElement.setAttribute(
            "data-omni-tracer",
            JSON.stringify(payload)
          );

          document.documentElement.dispatchEvent(
            new Event("omni-tracer-event")
          );

        } catch (e) {
          //console.warn("OmniTracer error:", e);
        }

      });

      return send.apply(this, arguments);
    };

    return xhr;
  };

})();
