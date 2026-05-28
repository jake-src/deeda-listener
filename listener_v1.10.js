console.log("⛑️🔥 DeeDa EXTERNAL listener loaded");

// =====================================================
// CONFIG (change only these later)
// =====================================================
const META_PRIMARY_STANDARD_EVENT = "Purchase"; // future: "Donate"
const META_SHADOW_CUSTOM_EVENT = "Donate";      // shadow tracking
const TRACK_WIDGET = true; // set false if widget events should be ignored

// =====================================================
// Debug helper (safe to keep)
// =====================================================
window._deeda_debug = { fbq_calls: [] };

// =====================================================
// Helper: Safe Meta trigger (standard or custom)
// =====================================================
function safeFbq(trackType, eventName, payload, attempt) {
  const retries = attempt || 0;
  window._deeda_debug.fbq_calls.push({ type: trackType, eventName, payload, ts: Date.now() });

  if (typeof fbq !== "function") {
    if (retries >= 10) {
      console.warn("⛑️⚠️ fbq never loaded — gave up after 10 retries");
      return;
    }
    console.log("⛑️⚠️ fbq not ready (" + trackType + "), retrying...");
    setTimeout(function () { safeFbq(trackType, eventName, payload, retries + 1); }, 300);
    return;
  }

  const method = trackType === "custom" ? "trackCustom" : "track";
  console.log("⛑️🔥 META FIRED:", trackType, eventName, payload);
  fbq(method, eventName, payload || {});
}

// =====================================================
// Helper: GA4 tracking
// =====================================================
function fireGA4(eventName, params) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
  console.log("⛑️📊 GA4 EVENT:", eventName, params);
}

// =====================================================
// Attribution helpers (UTMs + Meta)
// =====================================================
const urlParams = new URLSearchParams(window.location.search);

function getAttributionParams() {
  return {
    utm_source:   urlParams.get("utm_source"),
    utm_medium:   urlParams.get("utm_medium"),
    utm_campaign: urlParams.get("utm_campaign"),
    utm_content:  urlParams.get("utm_content"),
    utm_term:     urlParams.get("utm_term"),
    fbclid:       urlParams.get("fbclid")
  };
}

// =====================================================
// Guard helpers
// =====================================================
function isValidDeedaEvent(event) {
  return !!(event.origin && event.origin.includes("deeda.care") && event.data);
}

function getDeedaEventData(event) {
  return {
    name:       event.data.event,
    type:       event.data.type,
    payload:    event.data.extInfo || {},
    widgetNo:   event.data.widgetNo   || null,
    widgetType: event.data.widgetType || null
  };
}

function isSupportedSurface(widgetType) {
  return widgetType === "embed" || (TRACK_WIDGET && widgetType === "widget");
}

// =====================================================
// Event handlers
// =====================================================
function handleEnterPersonal(widgetType, widgetNo) {
  safeFbq("standard", "InitiateCheckout", { source: "deeda", widgetType });
  fireGA4("form_view", { ...getAttributionParams(), widgetType, widgetNo });
}

function handleComplete(payload, widgetType, widgetNo) {
  const conversionPayload = {
    value:          payload.amount        || 0,
    currency:       payload.currency      || "SGD",
    transaction_id: payload.transactionId || "",   // Meta requires string
    widgetType
  };
  fireGA4("donation_complete", {
    ...getAttributionParams(),
    value:          payload.amount        || 0,
    currency:       payload.currency      || "SGD",
    transaction_id: payload.transactionId || null, // GA4: null when absent
    widgetType,
    widgetNo
  });
  safeFbq("standard", META_PRIMARY_STANDARD_EVENT, conversionPayload);
  safeFbq("custom",   META_SHADOW_CUSTOM_EVENT,    conversionPayload);
}

// =====================================================
// Main DeeDa message handler
// =====================================================
function handleDeedaMessage(event) {
  if (!isValidDeedaEvent(event)) return;

  console.log("⛑️🔥 DeeDa MESSAGE RECEIVED:", event.data);

  const { name, type, payload, widgetNo, widgetType } = getDeedaEventData(event);

  if (!isSupportedSurface(widgetType)) {
    console.log("⛑️⚠️ DeeDa event ignored (surface filtered)");
    return;
  }

  fireGA4("deeda_event", {
    ...getAttributionParams(),
    deeda_event_name:  name,
    deeda_event_type:  type,
    widgetType,
    widgetNo,
    value:          payload.amount        || null,
    currency:       payload.currency      || "SGD",
    transaction_id: payload.transactionId || null
  });

  if (name === "enter_personal") handleEnterPersonal(widgetType, widgetNo);
  if (name === "complete")       handleComplete(payload, widgetType, widgetNo);
}

window.addEventListener("message", handleDeedaMessage);
