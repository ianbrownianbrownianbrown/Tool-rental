const SUPABASE_URL = "https://gduefgyrvlreemgbwqwz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NHOjLft-27b1keRip9gJCQ_moJFd_IO";
const LISTINGS_TABLE = "listings";
const savedRequestKey = "honeyDoRequests";

const starterTools = [
  {
    id: "starter-drill",
    name: "Cordless Drill Kit",
    category: "Drill",
    neighborhood: "Eastown",
    dailyPrice: "$12/day",
    weekendPrice: "$25/weekend",
    deposit: "$30 deposit",
    owner: "Marcus - 4.9 stars",
    ownerContact: "Message in app",
    included: "Two batteries, charger, bit set, and carrying case.",
    source: "starter",
  },
  {
    id: "starter-ladder",
    name: "Extension Ladder",
    category: "Ladder",
    neighborhood: "Alger Heights",
    dailyPrice: "$18/day",
    weekendPrice: "$40/weekend",
    deposit: "$50 deposit",
    owner: "Jenna - 5.0 stars",
    ownerContact: "Message in app",
    included: "Twenty-four foot extension ladder with stabilizer.",
    source: "starter",
  },
  {
    id: "starter-sander",
    name: "Floor Sander",
    category: "Sander",
    neighborhood: "Heritage Hill",
    dailyPrice: "$35/day",
    weekendPrice: "$80/weekend",
    deposit: "$100 deposit",
    owner: "Rob - 4.8 stars",
    ownerContact: "Message in app",
    included: "Floor sander, dust bag, and starter sanding pads.",
    source: "starter",
  },
  {
    id: "starter-scanner",
    name: "OBD2 Scanner",
    category: "Auto",
    neighborhood: "Kentwood",
    dailyPrice: "$10/day",
    weekendPrice: "$20/weekend",
    deposit: "$20 deposit",
    owner: "Alisha - 4.9 stars",
    ownerContact: "Message in app",
    included: "OBD2 scanner with basic code lookup guide.",
    source: "starter",
  },
];

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const previewListingButton = document.querySelector("#previewListingButton");
const postRequestButton = document.querySelector("#postRequestButton");
const listingForm = document.querySelector("#listingForm");
const listingPreview = document.querySelector("#listingPreview");
const listingStatus = document.querySelector("#listingStatus");
const browseStatus = document.querySelector("#browseStatus");
const toolGrid = document.querySelector(".tool-grid");
const requestForm = document.querySelector("#requestForm");
const requestPreview = document.querySelector("#requestPreview");
const requestList = document.querySelector("#requestList");
const requestStatus = document.querySelector("#requestStatus");
const postedRequests = loadSavedRequests();
let sharedListings = [];

function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value).replace(/[&<>"']/g, function (character) {
    return entities[character];
  });
}

function normalizeListing(row) {
  return {
    id: row.id,
    name: row.tool_name,
    category: row.category || "Tool",
    neighborhood: row.neighborhood || "Grand Rapids",
    dailyPrice: row.daily_price || "$0/day",
    weekendPrice: row.weekend_price || "$0/weekend",
    deposit: row.deposit || "No deposit listed",
    owner: row.owner_name || "Guest owner",
    ownerContact: row.owner_contact || "Contact not listed",
    included: row.description || "No description yet.",
    status: row.status || "available",
    source: "shared",
  };
}

function getListingFormValues() {
  return {
    name: document.querySelector("#toolName").value.trim(),
    category: document.querySelector("#toolCategory").value.trim(),
    neighborhood: document.querySelector("#toolNeighborhood").value.trim(),
    dailyPrice: document.querySelector("#toolDailyPrice").value.trim(),
    weekendPrice: document.querySelector("#toolWeekendPrice").value.trim(),
    owner: document.querySelector("#ownerName").value.trim(),
    ownerContact: document.querySelector("#ownerContact").value.trim(),
    included: document.querySelector("#toolDescription").value.trim(),
  };
}

function listingToRow(listing) {
  return {
    tool_name: listing.name,
    category: listing.category || null,
    neighborhood: listing.neighborhood || null,
    daily_price: listing.dailyPrice || null,
    weekend_price: listing.weekendPrice || null,
    deposit: listing.deposit || null,
    description: listing.included || null,
    owner_name: listing.owner || null,
    owner_contact: listing.ownerContact || null,
    status: "available",
  };
}

function createToolCard(tool) {
  const toolCard = document.createElement("article");
  toolCard.classList.add("tool-card");

  if (tool.source === "shared") {
    toolCard.classList.add("shared-listing");
  }

  toolCard.innerHTML = `
    <div class="tool-image">${escapeHtml(tool.category || "Tool")}</div>
    <h3>${escapeHtml(tool.name || "Untitled Tool")}</h3>
    <p>${escapeHtml(tool.neighborhood || "Grand Rapids")} - ${escapeHtml(tool.dailyPrice || "$0/day")} - ${escapeHtml(
    tool.weekendPrice || "$0/weekend"
  )}</p>
    <p class="listing-owner">Listed by ${escapeHtml(tool.owner || "Guest owner")}</p>
    <button type="button">View Tool</button>
  `;

  const viewButton = toolCard.querySelector("button");

  viewButton.addEventListener("click", function () {
    showToolDetails(tool);
  });

  return toolCard;
}

function renderToolGrid() {
  toolGrid.innerHTML = "";

  starterTools.concat(sharedListings).forEach(function (tool) {
    toolGrid.appendChild(createToolCard(tool));
  });
}

async function loadSharedListings() {
  renderToolGrid();

  if (!supabaseClient) {
    browseStatus.textContent = "Shared listings are unavailable because Supabase did not load.";
    return;
  }

  browseStatus.textContent = "Loading shared listings...";

  const response = await supabaseClient
    .from(LISTINGS_TABLE)
    .select("id, tool_name, category, neighborhood, daily_price, weekend_price, deposit, description, owner_name, owner_contact, status, created_at")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (response.error) {
    browseStatus.textContent = "Shared listings are not ready yet. Create the listings table in Supabase, then refresh.";
    return;
  }

  sharedListings = response.data.map(normalizeListing);
  renderToolGrid();
  browseStatus.textContent = sharedListings.length
    ? `${sharedListings.length} shared listing${sharedListings.length === 1 ? "" : "s"} loaded.`
    : "No shared listings yet. Publish one below.";
}

async function publishListing(listing) {
  if (!supabaseClient) {
    listingStatus.textContent = "Supabase did not load, so this listing could not be shared.";
    return;
  }

  listingStatus.textContent = "Publishing your listing...";

  const response = await supabaseClient
    .from(LISTINGS_TABLE)
    .insert(listingToRow(listing))
    .select("id, tool_name, category, neighborhood, daily_price, weekend_price, deposit, description, owner_name, owner_contact, status, created_at")
    .single();

  if (response.error) {
    listingStatus.textContent = "Could not publish yet. Check that the listings table and guest insert policy exist in Supabase.";
    return;
  }

  sharedListings.unshift(normalizeListing(response.data));
  renderToolGrid();
  listingForm.reset();
  listingPreview.innerHTML = "";
  listingStatus.textContent = "Your tool is now listed for everyone using the app.";
}

function showToolDetails(tool) {
  alert(
    tool.name +
      "\n" +
      tool.neighborhood +
      "\n" +
      tool.dailyPrice +
      " - " +
      tool.weekendPrice +
      "\n" +
      tool.deposit +
      "\nListed by: " +
      tool.owner +
      "\nContact: " +
      tool.ownerContact +
      "\n\nIncluded: " +
      tool.included
  );
}

function loadSavedRequests() {
  try {
    const savedRequests = JSON.parse(localStorage.getItem(savedRequestKey) || "[]");

    if (Array.isArray(savedRequests)) {
      return savedRequests;
    }
  } catch (error) {
    return [];
  }

  return [];
}

function saveRequests() {
  try {
    localStorage.setItem(savedRequestKey, JSON.stringify(postedRequests));
    return true;
  } catch (error) {
    return false;
  }
}

function setRequestStatus(message) {
  requestStatus.textContent = message;
}

function getRequestFormValues() {
  return {
    id: "request-" + Date.now(),
    tool: document.querySelector("#requestTool").value.trim(),
    date: document.querySelector("#requestDate").value.trim(),
    neighborhood: document.querySelector("#requestNeighborhood").value.trim(),
    budget: document.querySelector("#requestBudget").value.trim(),
    notes: document.querySelector("#requestNotes").value.trim(),
  };
}

function createRequestCard(request) {
  const requestCard = document.createElement("article");
  requestCard.classList.add("tool-card", "request-card");

  requestCard.innerHTML = `
    <div class="tool-image">Request</div>
    <h3>${escapeHtml(request.tool || "Untitled Request")}</h3>
    <p class="request-meta">${escapeHtml(request.neighborhood || "Grand Rapids")} - ${escapeHtml(
    request.date || "Flexible timing"
  )} - ${escapeHtml(request.budget || "Budget open")}</p>
    <p>${escapeHtml(request.notes || "No extra details yet.")}</p>
  `;

  return requestCard;
}

function renderRequestList() {
  requestList.innerHTML = "";

  if (postedRequests.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("empty-state");
    emptyMessage.textContent = "No open requests yet.";
    requestList.appendChild(emptyMessage);
    return;
  }

  postedRequests.forEach(function (request) {
    requestList.appendChild(createRequestCard(request));
  });
}

function publishRequest(request) {
  postedRequests.unshift(request);

  const wasSaved = saveRequests();

  renderRequestList();
  requestForm.reset();
  requestPreview.innerHTML = "";
  setRequestStatus(
    wasSaved
      ? "Your request has been posted."
      : "Your request is posted for this session, but this browser could not save it."
  );
}

previewListingButton.addEventListener("click", function () {
  const listing = getListingFormValues();

  if (!listing.name) {
    listingStatus.textContent = "Add a tool name before previewing your listing.";
    document.querySelector("#toolName").focus();
    return;
  }

  listingStatus.textContent = "Preview your listing, then publish it when it looks right.";

  listingPreview.innerHTML = `
    <article class="tool-card preview-card">
      <div class="tool-image">${escapeHtml(listing.category || "New Listing")}</div>
      <h3>${escapeHtml(listing.name)}</h3>
      <p>${escapeHtml(listing.neighborhood || "Grand Rapids")} - ${escapeHtml(
    listing.dailyPrice || "$0/day"
  )} - ${escapeHtml(listing.weekendPrice || "$0/weekend")}</p>
      <p>${escapeHtml(listing.included || "No description yet.")}</p>
      <p class="listing-owner">Listed by ${escapeHtml(listing.owner || "Guest owner")}</p>
      <button id="publishListingButton" type="button">Publish Listing</button>
    </article>
  `;

  const publishListingButton = document.querySelector("#publishListingButton");

  publishListingButton.addEventListener("click", function () {
    publishListing({
      name: listing.name,
      neighborhood: listing.neighborhood || "Grand Rapids",
      dailyPrice: listing.dailyPrice || "$0/day",
      weekendPrice: listing.weekendPrice || "$0/weekend",
      deposit: "No deposit listed",
      owner: listing.owner || "Guest owner",
      ownerContact: listing.ownerContact || "Contact not listed",
      included: listing.included || "No description yet.",
      category: listing.category || "New Listing",
    });
  });
});

postRequestButton.addEventListener("click", function () {
  const request = getRequestFormValues();

  if (!request.tool) {
    setRequestStatus("Add the tool you need before previewing your request.");
    document.querySelector("#requestTool").focus();
    return;
  }

  setRequestStatus("Preview your request, then post it when it looks right.");

  requestPreview.innerHTML = `
    <article class="tool-card preview-card">
      <div class="tool-image">Request</div>
      <h3>${escapeHtml(request.tool)}</h3>
      <p>${escapeHtml(request.neighborhood || "Grand Rapids")} - ${escapeHtml(
    request.date || "Flexible timing"
  )} - ${escapeHtml(request.budget || "Budget open")}</p>
      <p>${escapeHtml(request.notes || "No extra details yet.")}</p>
      <button id="publishRequestButton" type="button">Post Request</button>
    </article>
  `;

  const publishRequestButton = document.querySelector("#publishRequestButton");

  publishRequestButton.addEventListener("click", function () {
    publishRequest(request);
  });
});

loadSharedListings();
renderRequestList();
