const SUPABASE_URL = "https://gduefgyrvlreemgbwqwz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NHOjLft-27b1keRip9gJCQ_moJFd_IO";

(function () {
  "use strict";
  const D = window.WeekenderDomain;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const icon = (name) => '<i data-lucide="' + name + '" aria-hidden="true"></i>';
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) },
  });
  const listingColumns = "id,tool_name,category,neighborhood,daily_price,weekend_price,description,owner_name,status,created_at,owner_id,daily_rate,weekend_rate,photo_url,updated_at";
  const statusLabels = { pending: "Awaiting owner", approved: "Approved - confirm rental", confirmed: "Ready for pickup", active: "On rental", completed: "Returned", declined: "Declined", cancelled: "Cancelled" };
  const actionLabels = { approve: "Approve request", decline: "Decline", confirm: "Confirm with test payment", pickup: "Mark picked up", complete: "Mark returned", cancel: "Cancel rental" };
  const state = { session: null, profile: null, listings: [], own: [], rentals: [], requests: [], tab: "renting", loaded: false, activityLoaded: false };
  let selectedTool = null;
  let selectedBookings = [];
  let bookingLoad = 0;
  let pendingProfileAction = null;
  let listingId = crypto.randomUUID();
  let editing = false;
  let existingPhoto = "";
  let photoFile = null;
  let photoPreviewUrl = "";
  let uploadedPhoto = null;
  let listingDraft = null;
  let rentalId = crypto.randomUUID();
  let requestId = crypto.randomUUID();
  let activeAction = null;
  let refreshPromise = null;

  function icons() { window.lucide?.createIcons(); }
  function status(id, message, error = false) {
    const target = $("#" + id);
    target.textContent = message;
    target.classList.toggle("error", error);
  }
  function announce(message, error = false) {
    status("globalStatus", message, error);
    $("#globalStatus").hidden = !message;
  }
  function friendly(error) {
    console.error("Weekender:", error?.code || "", error?.message || error);
    if (!navigator.onLine) return "You're offline. Reconnect and try again; your form is still here.";
    if (["PGRST202", "PGRST204", "42P01", "42703"].includes(error?.code)) return "This part of Weekender is not ready yet. Please try again later.";
    if (error?.code === "anonymous_provider_disabled") return "Guest access is not available yet. Please try again later.";
    if (error?.code === "over_request_rate_limit" || error?.status === 429) return "Too many attempts just now. Wait a moment and try again.";
    if (error?.code === "42501") return "This action is not available to your guest account. Refresh and try again.";
    if (/fetch|network|timeout|abort/i.test(error?.message || "")) return "The connection did not finish. Try again; your form is still here.";
    return error?.message || "Something went wrong. Please try again.";
  }
  async function result(query) {
    const response = await query;
    if (response.error) throw response.error;
    return response.data;
  }
  async function busy(button, statusId, task) {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const dialog = button.closest("dialog");
    if (dialog) dialog.dataset.busy = "true";
    try { await task(); }
    catch (error) { status(statusId, friendly(error), true); }
    finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      if (dialog) delete dialog.dataset.busy;
    }
  }
  function showDialog(id) {
    const dialog = $("#" + id);
    if (!dialog.open) dialog.showModal();
    icons();
  }
  function requireProfile(action) {
    if (state.profile && state.session) { action(); return; }
    pendingProfileAction = action;
    openProfile();
  }
  function openProfile() {
    $("#guestName").value = state.profile?.display_name || "";
    $("#guestContact").value = state.profile?.contact || "";
    $("#saveProfileButton").textContent = state.profile ? "Save profile" : "Continue as guest";
    status("profileStatus", "");
    showDialog("profileDialog");
  }
  function renderIdentity() {
    const name = state.profile?.display_name;
    $("#activityGuest").textContent = name ? name + "'s guest account" : "Your guest account";
    $("#listingIdentity").textContent = name ? "Listed by " + name : "Add your guest details when you publish.";
    $("#profileButton").title = name ? "Guest profile: " + name : "Your guest profile";
    $("#profileButton").setAttribute("aria-label", $("#profileButton").title);
  }
  async function loadProfile() {
    state.profile = state.session ? await result(client.from("profiles").select("id,display_name,contact").eq("id", state.session.user.id).maybeSingle()) : null;
    renderIdentity();
  }
  async function saveProfile(event) {
    event.preventDefault();
    await busy($("#saveProfileButton"), "profileStatus", async () => {
      if (!client) throw new Error("Weekender could not load. Please refresh the page.");
      const name = $("#guestName").value.trim();
      const contact = $("#guestContact").value.trim();
      if (!name || contact.length < 3) throw new Error("Add your name and a contact method.");
      status("profileStatus", "Saving your guest profile...");
      if (!state.session) {
        const data = await result(client.auth.signInAnonymously());
        state.session = data.session;
      }
      const profile = { id: state.session.user.id, display_name: name, contact };
      await result(client.from("profiles").upsert(profile));
      state.profile = profile;
      renderIdentity();
      const next = pendingProfileAction;
      pendingProfileAction = null;
      $("#profileDialog").close();
      await loadActivity();
      if (next) next();
      else announce("Your guest profile is saved.");
    });
  }
  function route() {
    const page = ["browse", "activity", "list", "requests"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "browse";
    $$(".page").forEach((section) => { section.hidden = section.id !== page; });
    $("#browseMasthead").hidden = page !== "browse";
    $$("[data-route]").forEach((link) => {
      if (link.dataset.route === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (page === "activity") renderActivity();
    document.title = (page === "browse" ? "Tools for your next project" : { activity: "My activity", list: editing ? "Edit tool" : "List a tool", requests: "Request board" }[page]) + " | Weekender";
  }
  function go(page) {
    if (location.hash === "#" + page) route();
    else location.hash = page;
    window.scrollTo({ top: 0 });
  }
  function empty(title, message, action = "") {
    return '<div class="empty-state">' + icon("wrench") + "<h2>" + escape(title) + "</h2><p>" + escape(message) + "</p>" + action + "</div>";
  }
  function photoMarkup(tool, className = "tool-media") {
    const url = D.safeImage(tool.photo_url);
    return url ? '<img class="' + className + '" src="' + escape(url) + '" alt="' + escape(tool.tool_name) + '" loading="lazy" />' : '<div class="' + className + '">' + icon("wrench") + '<span>No photo</span></div>';
  }
  function attachPhotoFallback(root) {
    root.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => {
        const fallback = document.createElement("div");
        fallback.className = image.className;
        fallback.textContent = "Photo unavailable";
        image.replaceWith(fallback);
      }, { once: true });
    });
  }
  function toolCard(tool, own = false) {
    const card = document.createElement("article");
    card.className = "tool-card";
    const price = tool.daily_rate ? D.money(tool.daily_rate) : tool.daily_price || "Price not listed";
    card.innerHTML = photoMarkup(tool) + '<div class="card-body"><p class="card-category">' + escape(tool.category || "Tool") + '</p><h3>' + escape(tool.tool_name) + '</h3><p class="card-location">' + icon("map-pin") + escape(tool.neighborhood || "Grand Rapids") + '</p><div class="card-price"><strong>' + escape(price) + '</strong>' + (tool.daily_rate ? "<span>/ day</span>" : "") + '</div><p class="muted small">' + (tool.weekend_rate ? escape(D.money(tool.weekend_rate)) + " Friday-Sunday" : " ") + '</p><p class="muted small">Listed by ' + escape(tool.owner_name || "Guest owner") + '</p><div class="card-actions"></div></div>';
    const actions = card.querySelector(".card-actions");
    if (own) {
      const edit = document.createElement("button");
      edit.className = "secondary-button";
      edit.innerHTML = icon("pencil") + "Edit";
      edit.onclick = () => editListing(tool);
      const toggle = document.createElement("button");
      toggle.className = "secondary-button";
      toggle.innerHTML = icon(tool.status === "available" ? "pause" : "play") + (tool.status === "available" ? "Pause listing" : "Relist tool");
      toggle.onclick = async () => {
        toggle.disabled = true;
        try {
          await result(client.rpc("set_listing_status", { p_id: tool.id, p_status: tool.status === "available" ? "paused" : "available" }));
          announce(tool.status === "available" ? "Listing paused. Existing rentals remain in My activity." : "Your tool is available again.");
          await refresh();
        } catch (error) { announce(friendly(error), true); toggle.disabled = false; }
      };
      const badge = document.createElement("span");
      badge.className = "status-pill";
      badge.textContent = tool.status === "available" ? "Listed" : "Paused";
      card.querySelector(".card-category").append(" ", badge);
      actions.append(edit, toggle);
    } else {
      const button = document.createElement("button");
      button.className = "secondary-button";
      button.textContent = tool.owner_id === state.session?.user.id ? "View your tool" : "View & request";
      button.onclick = () => openTool(tool);
      actions.append(button);
    }
    attachPhotoFallback(card);
    return card;
  }
  function renderTools() {
    const query = $("#searchInput").value.trim().toLowerCase();
    const category = $("#categoryFilter").value;
    const sort = $("#sortFilter").value;
    const tools = state.listings.filter((tool) => (!category || tool.category === category) && (!query || [tool.tool_name, tool.description, tool.neighborhood, tool.category].join(" ").toLowerCase().includes(query)));
    if (sort !== "newest") tools.sort((a, b) => sort === "price-low" ? (a.daily_rate ?? Infinity) - (b.daily_rate ?? Infinity) : (b.daily_rate ?? -Infinity) - (a.daily_rate ?? -Infinity));
    const grid = $("#toolGrid");
    grid.replaceChildren(...tools.map((tool) => toolCard(tool)));
    if (!tools.length && state.loaded) grid.innerHTML = empty(query || category ? "No matching tools" : "Be the first to list a tool", query || category ? "Try a different tool, neighborhood, or category." : "Have something useful in the garage? Give it a second weekend.", '<a class="button" href="#list">List a tool</a>');
    if (state.loaded) status("browseStatus", tools.length + (tools.length === 1 ? " tool" : " tools") + (query || category ? " matching your search" : " available"));
    icons();
  }
  async function loadListings() {
    const data = await result(client.from("listings").select(listingColumns).eq("status", "available").order("created_at", { ascending: false }));
    state.listings = data;
    state.loaded = true;
    renderTools();
  }
  async function loadActivity() {
    if (!state.session) {
      state.own = []; state.rentals = []; state.activityLoaded = true;
    } else {
      const data = await result(client.rpc("get_my_activity"));
      state.own = data.listings || [];
      state.rentals = data.rentals || [];
      state.activityLoaded = true;
    }
    renderActivity();
    const attention = state.rentals.filter((r) => (r.owner_id === state.session?.user.id && r.status === "pending") || (r.renter_id === state.session?.user.id && r.status === "approved")).length;
    $("#activityBadge").hidden = !attention;
    $("#activityBadge").textContent = attention;
  }
  async function loadRequests() {
    state.requests = await result(client.from("tool_requests").select("id,author_id,author_name,tool_name,needed_date,neighborhood,budget,notes,status,created_at").order("created_at", { ascending: false }));
    renderRequests();
  }
  async function refresh() {
    if (refreshPromise) return refreshPromise;
    if (!client) { announce("Weekender could not load. Please refresh the page.", true); return; }
    refreshPromise = (async () => {
      const outcomes = await Promise.allSettled([loadListings(), loadActivity(), loadRequests()]);
      const ids = ["browseStatus", "rentalDashboardStatus", "requestBoardStatus"];
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "rejected") status(ids[index], friendly(outcome.reason), true);
      });
    })();
    try { await refreshPromise; } finally { refreshPromise = null; }
  }
  async function openTool(tool) {
    selectedTool = tool;
    selectedBookings = [];
    rentalId = crypto.randomUUID();
    const thisLoad = ++bookingLoad;
    $("#rentForm").reset();
    $("#rentalStart").min = D.today();
    $("#rentalEnd").min = D.today();
    $("#toolDetailTitle").textContent = tool.tool_name;
    $("#toolDetails").innerHTML = (tool.photo_url ? photoMarkup(tool, "tool-detail-photo") : "") + '<p class="card-location">' + icon("map-pin") + escape(tool.neighborhood) + '</p><p class="card-price"><strong>' + escape(tool.daily_rate ? D.money(tool.daily_rate) : tool.daily_price) + '</strong><span>/ day</span></p>' + (tool.weekend_rate ? "<p>" + escape(D.money(tool.weekend_rate)) + " Friday-Sunday</p>" : "") + '<p class="detail-description">' + escape(tool.description) + '</p><p class="muted small">Listed by ' + escape(tool.owner_name) + "</p>";
    attachPhotoFallback($("#toolDetails"));
    const rentable = tool.owner_id && tool.daily_rate && tool.owner_id !== state.session?.user.id;
    $("#rentForm").hidden = !rentable;
    if (!rentable) $("#toolDetails").insertAdjacentHTML("beforeend", '<p class="muted">' + (tool.owner_id === state.session?.user.id ? 'This is your tool. Manage it in <a href="#activity" id="manageOwnTool">My activity</a>.' : "This earlier listing is not accepting requests yet.") + "</p>");
    $("#manageOwnTool")?.addEventListener("click", () => { $("#toolDialog").close(); setActivityTab("listings"); });
    $("#rentalQuote").textContent = "Choose dates to see the total.";
    status("rentStatus", "");
    $("#bookingAvailability").textContent = "Checking booked dates...";
    showDialog("toolDialog");
    try {
      const bookings = await result(client.rpc("listing_bookings", { p_listing: tool.id }));
      if (thisLoad !== bookingLoad) return;
      selectedBookings = bookings || [];
      $("#bookingAvailability").textContent = selectedBookings.length ? "Already booked: " + selectedBookings.map((b) => D.dateLabel(b.start_date) + " to " + D.dateLabel(b.end_date)).join("; ") : "No dates are booked yet.";
      updateQuote();
    } catch (error) { if (thisLoad === bookingLoad) $("#bookingAvailability").textContent = "Availability will be checked again when you send your request."; }
  }
  function updateQuote() {
    $("#rentalEnd").min = $("#rentalStart").value || D.today();
    if (!$("#rentalStart").value || !$("#rentalEnd").value) return;
    try {
      const start = $("#rentalStart").value, end = $("#rentalEnd").value;
      const quote = D.quote(selectedTool, start, end);
      if (selectedBookings.some((b) => D.overlaps(start, end, b.start_date, b.end_date))) throw new Error("These dates overlap an existing booking.");
      $("#rentalQuote").classList.remove("error");
      $("#rentalQuote").innerHTML = "<span>" + escape(quote.rateLabel) + "</span><strong>" + D.money(quote.total) + "</strong>";
      status("rentStatus", "");
    } catch (error) { $("#rentalQuote").textContent = error.message; $("#rentalQuote").classList.add("error"); }
  }
  function submitRental(event) {
    event.preventDefault();
    requireProfile(() => busy($("#submitRentalButton"), "rentStatus", async () => {
      const tool = selectedTool;
      const start = $("#rentalStart").value, end = $("#rentalEnd").value;
      D.quote(tool, start, end);
      if (selectedBookings.some((b) => D.overlaps(start, end, b.start_date, b.end_date))) throw new Error("Those dates are already booked. Choose other dates.");
      status("rentStatus", "Sending your request...");
      await result(client.rpc("request_rental", { p_id: rentalId, p_listing: tool.id, p_start: start, p_end: end, p_message: $("#rentalMessage").value.trim() }));
      $("#toolDialog").close();
      setActivityTab("renting");
      $("#activityFilter").value = "current";
      go("activity");
      announce("Request sent. The owner can now approve or decline it.");
      await refresh();
    }));
  }
  function setActivityTab(tab) {
    state.tab = tab;
    $$("[data-activity]").forEach((button) => {
      const active = button.dataset.activity === tab;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $("#activityContent").setAttribute("aria-labelledby", "tab-" + tab);
    $("#activityFilter").closest("label").hidden = tab === "listings";
    renderActivity();
  }
  function renderActivity() {
    const container = $("#activityContent");
    if (!state.profile) {
      container.innerHTML = empty("Your next project starts here", "Continue as a guest to manage your listings and rentals.", '<button id="activityJoin">Continue as guest</button>');
      $("#activityJoin").onclick = openProfile;
      status("rentalDashboardStatus", "");
      icons(); return;
    }
    if (state.tab === "listings") {
      container.className = "tool-grid";
      container.replaceChildren(...state.own.map((tool) => toolCard(tool, true)));
      if (!state.own.length) container.innerHTML = empty("No tools listed yet", "Your listings will appear here.", '<a class="button" href="#list">List a tool</a>');
      status("rentalDashboardStatus", state.own.length + (state.own.length === 1 ? " tool" : " tools"));
    } else {
      container.className = "";
      const mine = state.session?.user.id;
      const filter = $("#activityFilter").value;
      const rows = state.rentals.filter((r) => (state.tab === "lending" ? r.owner_id === mine : r.renter_id === mine) && (filter === "all" || (["completed", "declined", "cancelled"].includes(r.status) === (filter === "past"))));
      container.replaceChildren(...rows.map(rentalCard));
      if (!rows.length) container.innerHTML = empty("No " + (filter === "past" ? "past " : "") + "rentals here yet", state.tab === "renting" ? "Find a tool and send the owner a rental request." : "Requests for your tools will appear here.", '<a class="button secondary-button" href="' + (state.tab === "renting" ? "#browse" : "#list") + '">' + (state.tab === "renting" ? "Browse tools" : "List a tool") + "</a>");
      status("rentalDashboardStatus", rows.length + (rows.length === 1 ? " rental" : " rentals"));
    }
    icons();
  }
  function rentalCard(rental) {
    const role = rental.owner_id === state.session?.user.id ? "owner" : "renter";
    const row = document.createElement("article");
    row.className = "rental-row";
    const contactName = role === "owner" ? rental.renter_name : rental.owner_name;
    const contact = role === "owner" ? rental.renter_contact : rental.owner_contact;
    const payment = { not_paid: "No payment yet", simulated: "Test payment confirmed. No money charged.", simulated_refund: "Test payment reversed. No money charged." }[rental.payment_status] || "Test payment only";
    row.innerHTML = '<div><span class="status-pill status-' + escape(rental.status) + '">' + escape(statusLabels[rental.status] || rental.status) + '</span><h3>' + escape(rental.tool_name) + '</h3><p>' + escape(D.dateLabel(rental.start_date)) + " to " + escape(D.dateLabel(rental.end_date)) + '</p><p class="muted">' + escape(rental.neighborhood) + '</p><p class="rental-total">' + D.money(rental.total_price) + ' <span class="muted small">total</span></p><p class="muted small">' + escape(rental.rate_label) + '</p></div><div><p><strong>' + (role === "owner" ? "Renter: " : "Owner: ") + escape(contactName) + '</strong></p><p>' + escape(contact || "Contact not listed") + '</p>' + (rental.message ? '<p class="detail-description">' + escape(rental.message) + "</p>" : "") + '<p class="muted small">' + escape(payment) + '</p>' + (rental.status_reason ? '<p class="muted small">' + escape(rental.status_reason) + "</p>" : "") + '</div><div class="rental-actions"></div>';
    const area = row.querySelector(".rental-actions");
    D.actions(rental.status, role).forEach((action, index) => {
      const button = document.createElement("button");
      button.className = index > 0 || ["cancel", "decline"].includes(action) ? "secondary-button" : "";
      button.textContent = actionLabels[action];
      button.onclick = () => showRentalAction(rental, action);
      area.append(button);
    });
    return row;
  }
  function showRentalAction(rental, action) {
    activeAction = { rental, action };
    $("#actionTitle").textContent = actionLabels[action];
    $("#confirmActionButton").textContent = actionLabels[action];
    $("#confirmActionButton").classList.toggle("danger-button", ["cancel", "decline"].includes(action));
    const descriptions = {
      approve: "These dates will be reserved for this renter. Other pending requests that overlap will be declined.",
      decline: "The renter will see that this request was declined.",
      confirm: "This is a simulated payment. No money will be charged, and no payment details are needed.",
      pickup: "Confirm that the renter has picked up your tool.",
      complete: "Confirm that your tool has been returned.",
      cancel: "The booking will be cancelled and its dates released. Any test payment will be marked reversed.",
    };
    $("#actionSummary").innerHTML = "<h3>" + escape(rental.tool_name) + "</h3><p>" + escape(D.dateLabel(rental.start_date)) + " to " + escape(D.dateLabel(rental.end_date)) + '</p><p class="rental-total">' + D.money(rental.total_price) + ' total</p><p class="action-note">' + escape(descriptions[action]) + "</p>";
    status("actionStatus", "");
    showDialog("actionDialog");
  }
  async function confirmRentalAction() {
    await busy($("#confirmActionButton"), "actionStatus", async () => {
      if (!activeAction) return;
      const { rental, action } = activeAction;
      status("actionStatus", "Saving...");
      const next = await result(client.rpc("rental_action", { p_id: rental.id, p_action: action }));
      $("#actionDialog").close();
      if (["completed", "declined", "cancelled"].includes(next)) $("#activityFilter").value = "all";
      announce(action === "confirm" ? "Rental confirmed with a test payment. No money was charged." : rental.tool_name + ": " + (statusLabels[next] || next) + ".");
      await refresh();
    });
  }
  function listingValues() {
    return { p_id: listingId, p_name: $("#toolName").value.trim(), p_category: $("#toolCategory").value, p_neighborhood: $("#toolNeighborhood").value.trim(), p_daily: Number($("#toolDailyPrice").value), p_weekend: $("#toolWeekendPrice").value ? Number($("#toolWeekendPrice").value) : null, p_description: $("#toolDescription").value.trim(), p_photo: existingPhoto || null };
  }
  function reviewListing(event) {
    event.preventDefault();
    if (!$("#listingForm").reportValidity()) return;
    listingDraft = listingValues();
    if (!listingDraft.p_name || !listingDraft.p_description || !listingDraft.p_neighborhood) { status("listingStatus", "Add a tool name, neighborhood, and description.", true); return; }
    const photo = photoPreviewUrl || existingPhoto;
    $("#listingPreview").innerHTML = (photo ? '<img src="' + escape(photo) + '" alt="Listing photo preview" />' : "") + "<h3>" + escape(listingDraft.p_name) + '</h3><p class="muted">' + escape(listingDraft.p_category) + " &middot; " + escape(listingDraft.p_neighborhood) + '</p><p class="rental-total">' + D.money(listingDraft.p_daily) + "/day</p>" + (listingDraft.p_weekend ? "<p>" + D.money(listingDraft.p_weekend) + " Friday-Sunday</p>" : "") + '<p class="detail-description">' + escape(listingDraft.p_description) + "</p>";
    $("#publishListingButton").textContent = editing ? "Save changes" : "Publish listing";
    status("reviewStatus", "");
    showDialog("reviewDialog");
  }
  async function publishListing() {
    requireProfile(() => busy($("#publishListingButton"), "reviewStatus", async () => {
      if (!listingDraft) return;
      status("reviewStatus", photoFile ? "Uploading photo and publishing..." : "Publishing...");
      if (photoFile && !uploadedPhoto) {
        const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        const path = state.session.user.id + "/" + crypto.randomUUID() + "." + extensions[photoFile.type];
        await result(client.storage.from("tool-photos").upload(path, photoFile, { contentType: photoFile.type, cacheControl: "3600", upsert: false }));
        uploadedPhoto = { path, url: client.storage.from("tool-photos").getPublicUrl(path).data.publicUrl };
      }
      await result(client.rpc("save_listing", { ...listingDraft, p_photo: uploadedPhoto?.url || listingDraft.p_photo }));
      $("#reviewDialog").close();
      const wasEditing = editing;
      resetListing();
      setActivityTab("listings");
      go("activity");
      announce(wasEditing ? "Your listing has been updated." : "Your tool is listed. Other people can now request it.");
      await refresh();
    }));
  }
  function renderPhoto() {
    const url = photoPreviewUrl || existingPhoto;
    $("#photoPreview").innerHTML = url ? '<img src="' + escape(url) + '" alt="Your selected tool photo" />' : icon("camera") + "<span>No photo selected</span>";
    $("#removePhotoButton").hidden = !url;
    icons();
  }
  function resetListing() {
    $("#listingForm").reset();
    editing = false; listingId = crypto.randomUUID(); listingDraft = null;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    existingPhoto = ""; photoPreviewUrl = ""; photoFile = null; uploadedPhoto = null;
    $("#listingTitle").textContent = "List your tool";
    $("#cancelEditButton").hidden = true;
    status("listingStatus", "");
    renderPhoto();
  }
  function editListing(tool) {
    resetListing();
    editing = true; listingId = tool.id; existingPhoto = D.safeImage(tool.photo_url);
    $("#toolName").value = tool.tool_name;
    $("#toolCategory").value = tool.category;
    $("#toolNeighborhood").value = tool.neighborhood;
    $("#toolDailyPrice").value = tool.daily_rate || "";
    $("#toolWeekendPrice").value = tool.weekend_rate || "";
    $("#toolDescription").value = tool.description;
    $("#listingTitle").textContent = "Edit your tool";
    $("#cancelEditButton").hidden = false;
    renderPhoto(); go("list");
  }
  function renderRequests() {
    const visible = state.requests.filter((r) => r.status === "open");
    const list = $("#requestList");
    list.replaceChildren();
    status("requestBoardStatus", visible.length + (visible.length === 1 ? " open request" : " open requests"));
    visible.forEach((request) => {
      const card = document.createElement("article");
      card.className = "request-card";
      card.innerHTML = '<p class="card-category">Needed by ' + escape(D.dateLabel(request.needed_date)) + "</p><h3>" + escape(request.tool_name) + '</h3><p class="card-location">' + icon("map-pin") + escape(request.neighborhood) + '</p><p>' + (request.budget === null ? "Budget flexible" : D.money(request.budget) + " total budget") + '</p><p class="detail-description">' + escape(request.notes) + '</p><p class="muted small">Requested by ' + escape(request.author_name) + '</p><div class="card-actions"></div>';
      const button = document.createElement("button");
      button.className = "secondary-button";
      if (request.author_id === state.session?.user.id) {
        button.textContent = "Close request";
        button.onclick = async () => {
          button.disabled = true;
          try { await result(client.rpc("close_tool_request", { p_id: request.id })); await loadRequests(); announce("Your tool request is closed."); }
          catch (error) { announce(friendly(error), true); button.disabled = false; }
        };
      } else {
        button.textContent = "List this tool";
        button.onclick = () => { resetListing(); $("#toolName").value = request.tool_name; $("#toolNeighborhood").value = request.neighborhood; go("list"); };
      }
      card.querySelector(".card-actions").append(button);
      list.append(card);
    });
    if (!visible.length) list.innerHTML = empty("What are you working on?", "Post a tool you need and let the neighborhood know.", '<button id="emptyPostRequest">Post a request</button>');
    $("#emptyPostRequest")?.addEventListener("click", () => showDialog("requestDialog"));
    icons();
  }
  function postToolRequest(event) {
    event.preventDefault();
    requireProfile(() => busy($("#postRequestButton"), "requestStatus", async () => {
      status("requestStatus", "Posting...");
      await result(client.rpc("post_tool_request", { p_id: requestId, p_tool: $("#requestTool").value.trim(), p_date: $("#requestDate").value, p_neighborhood: $("#requestNeighborhood").value.trim(), p_budget: $("#requestBudget").value ? Number($("#requestBudget").value) : null, p_notes: $("#requestNotes").value.trim() }));
      $("#requestDialog").close(); $("#requestForm").reset(); requestId = crypto.randomUUID();
      announce("Your request is on the shared board.");
      await loadRequests();
    }));
  }

  D.categories.forEach((category) => {
    for (const id of ["categoryFilter", "toolCategory"]) {
      const option = document.createElement("option"); option.value = category; option.textContent = category; $("#" + id).append(option);
    }
  });
  $("#requestDate").min = D.today();
  $("#profileButton").onclick = openProfile;
  $("#profileForm").onsubmit = saveProfile;
  $("#searchForm").onsubmit = (event) => { event.preventDefault(); renderTools(); };
  $("#searchInput").oninput = renderTools;
  $("#categoryFilter").onchange = renderTools;
  $("#sortFilter").onchange = renderTools;
  $("#activityFilter").onchange = renderActivity;
  $("#listingForm").onsubmit = reviewListing;
  $("#rentForm").onsubmit = submitRental;
  $("#rentalStart").onchange = updateQuote;
  $("#rentalEnd").onchange = updateQuote;
  $("#publishListingButton").onclick = publishListing;
  $("#confirmActionButton").onclick = confirmRentalAction;
  $("#cancelEditButton").onclick = () => { resetListing(); go("activity"); };
  $("#requestForm").onsubmit = postToolRequest;
  $("#newRequestButton").onclick = () => { status("requestStatus", ""); showDialog("requestDialog"); };
  $("#toolPhoto").onchange = () => {
    const file = $("#toolPhoto").files[0];
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      status("listingStatus", "Choose a JPG, PNG, or WebP image under 5 MB.", true); $("#toolPhoto").value = ""; return;
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    photoFile = file || null; photoPreviewUrl = file ? URL.createObjectURL(file) : ""; uploadedPhoto = null;
    status("listingStatus", ""); renderPhoto();
  };
  $("#removePhotoButton").onclick = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    photoFile = null; photoPreviewUrl = ""; existingPhoto = ""; uploadedPhoto = null; $("#toolPhoto").value = ""; renderPhoto();
  };
  $$("[data-close]").forEach((button) => {
    button.onclick = () => { const dialog = $("#" + button.dataset.close); if (!dialog.dataset.busy) dialog.close(); };
  });
  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => { if (dialog.dataset.busy) event.preventDefault(); });
  });
  $("#profileDialog").addEventListener("close", () => { pendingProfileAction = null; });
  $$("[data-activity]").forEach((button, index, buttons) => {
    button.onclick = () => setActivityTab(button.dataset.activity);
    button.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      setActivityTab(buttons[next].dataset.activity); buttons[next].focus();
    };
  });
  $$(".refresh-button").forEach((button) => { button.onclick = async () => { button.disabled = true; try { await refresh(); } finally { button.disabled = false; } }; });
  window.addEventListener("hashchange", route);
  window.addEventListener("online", () => { announce("Connection restored."); refresh(); });
  window.addEventListener("offline", () => announce("You're offline. Changes will need a connection.", true));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden && navigator.onLine) refresh(); }, 15000);
  route(); icons(); renderIdentity();
  async function initialize() {
    if (!client) { announce("Weekender could not load. Please refresh the page.", true); return; }
    try {
      const data = await result(client.auth.getSession());
      state.session = data.session;
      await loadProfile();
    } catch (error) { announce(friendly(error), true); }
    await refresh();
  }
  initialize();
})();
