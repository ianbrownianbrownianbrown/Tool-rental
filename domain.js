(function (root) {
  "use strict";

  const DAY_MS = 86400000;
  const categories = ["Power tools", "Ladders", "Lawn & garden", "Painting & drywall", "Moving & hauling", "Specialty", "Auto"];

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }

  function today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }

  function dateRange(start, end, minimum = today()) {
    const first = parseDate(start);
    const last = parseDate(end);
    if (!first || !last) throw new Error("Choose a pickup date and a return date.");
    if (start < minimum) throw new Error("Pickup must be today or later.");
    if (end < start) throw new Error("Return must be on or after pickup.");
    const days = Math.round((last - first) / DAY_MS) + 1;
    if (days > 30) throw new Error("Choose a rental of 30 days or fewer.");
    return { days, first, last };
  }

  function quote(listing, start, end, minimum) {
    const range = dateRange(start, end, minimum);
    const daily = Number(listing.daily_rate);
    const weekend = Number(listing.weekend_rate);
    if (!Number.isFinite(daily) || daily <= 0) throw new Error("This tool does not have a valid daily price yet.");
    const dailyCents = Math.round(daily * 100) * range.days;
    const weekendApplies = range.days === 3 && range.first.getUTCDay() === 5 && weekend > 0;
    const useWeekend = weekendApplies && Math.round(weekend * 100) < dailyCents;
    return { days: range.days, total: (useWeekend ? Math.round(weekend * 100) : dailyCents) / 100, rateLabel: useWeekend ? "Friday-Sunday rate" : `${range.days} ${range.days === 1 ? "day" : "days"} at ${money(daily)}/day` };
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number(value) % 1 ? 2 : 0 }).format(Number(value) || 0);
  }

  function dateLabel(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date) : value;
  }

  function overlaps(start, end, otherStart, otherEnd) {
    return start <= otherEnd && end >= otherStart;
  }

  function actions(status, role) {
    if (role === "owner") {
      return { pending: ["approve", "decline"], approved: ["cancel"], confirmed: ["pickup", "cancel"], active: ["complete"] }[status] || [];
    }
    return { pending: ["cancel"], approved: ["confirm", "cancel"], confirmed: ["cancel"] }[status] || [];
  }

  function safeImage(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "gduefgyrvlreemgbwqwz.supabase.co" && url.pathname.startsWith("/storage/v1/object/public/tool-photos/") ? url.href : "";
    } catch (_) { return ""; }
  }

  const api = { categories, parseDate, today, dateRange, quote, money, dateLabel, overlaps, actions, safeImage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeekenderDomain = api;
})(typeof window !== "undefined" ? window : globalThis);
