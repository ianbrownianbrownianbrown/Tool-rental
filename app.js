const tools = {
  drill: {
    name: "Cordless Drill Kit",
    neighborhood: "Eastown",
    dailyPrice: "$12/day",
    weekendPrice: "$25/weekend",
    deposit: "$30 deposit",
    owner: "Marcus - 4.9 stars",
    included: "Two batteries, charger, bit set, and carrying case.",
  },

  ladder: {
    name: "Extension Ladder",
    neighborhood: "Alger Heights",
    dailyPrice: "$18/day",
    weekendPrice: "$40/weekend",
    deposit: "$50 deposit",
    owner: "Jenna - 5.0 stars",
    included: "Twenty-four foot extension ladder with stabilizer.",
  },

  sander: {
    name: "Floor Sander",
    neighborhood: "Heritage Hill",
    dailyPrice: "$35/day",
    weekendPrice: "$80/weekend",
    deposit: "$100 deposit",
    owner: "Rob - 4.8 stars",
    included: "Floor sander, dust bag, and starter sanding pads.",
  },

  scanner: {
    name: "OBD2 Scanner",
    neighborhood: "Kentwood",
    dailyPrice: "$10/day",
    weekendPrice: "$20/weekend",
    deposit: "$20 deposit",
    owner: "Alisha - 4.9 stars",
    included: "OBD2 scanner with basic code lookup guide.",
  },
};

const viewToolButtons = document.querySelectorAll(".tool-card button");
const previewListingButton = document.querySelector("#previewListingButton");
const postRequestButton = document.querySelector("#postRequestButton");
const toolGrid = document.querySelector(".tool-grid");
const requestForm = document.querySelector("#requestForm");
const requestPreview = document.querySelector("#requestPreview");
const requestList = document.querySelector("#requestList");
const requestStatus = document.querySelector("#requestStatus");
const savedRequestKey = "honeyDoRequests";
const postedRequests = loadSavedRequests();

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
      "\n" +
      tool.owner +
      "\n\nIncluded: " +
      tool.included
  );
}

viewToolButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const toolKey = button.dataset.tool;
    const tool = tools[toolKey];

    showToolDetails(tool);
  });
});

previewListingButton.addEventListener("click", function () {
  const toolName = document.querySelector("#toolName").value;
  const toolCategory = document.querySelector("#toolCategory").value;
  const toolNeighborhood = document.querySelector("#toolNeighborhood").value;
  const toolDailyPrice = document.querySelector("#toolDailyPrice").value;
  const toolWeekendPrice = document.querySelector("#toolWeekendPrice").value;
  const toolDescription = document.querySelector("#toolDescription").value;
  const listingPreview = document.querySelector("#listingPreview");

  listingPreview.innerHTML = `
    <article class="tool-card preview-card">
      <div class="tool-image">${escapeHtml(toolCategory || "New Listing")}</div>
      <h3>${escapeHtml(toolName || "Untitled Tool")}</h3>
      <p>${escapeHtml(toolNeighborhood || "Grand Rapids")} - ${escapeHtml(toolDailyPrice || "$0/day")} - ${escapeHtml(
    toolWeekendPrice || "$0/weekend"
  )}</p>
      <p>${escapeHtml(toolDescription || "No description yet.")}</p>
      <button id="publishListingButton" type="button">Publish Listing</button>
    </article>
  `;

  const publishListingButton = document.querySelector("#publishListingButton");

  publishListingButton.addEventListener("click", function () {
    const newTool = {
      name: toolName || "Untitled Tool",
      neighborhood: toolNeighborhood || "Grand Rapids",
      dailyPrice: toolDailyPrice || "$0/day",
      weekendPrice: toolWeekendPrice || "$0/weekend",
      deposit: "No deposit listed",
      owner: "Ian Brown",
      included: toolDescription || "No description yet.",
      category: toolCategory || "New Listing",
    };

    const newToolCard = document.createElement("article");
    newToolCard.classList.add("tool-card");

    newToolCard.innerHTML = `
      <div class="tool-image">${escapeHtml(newTool.category)}</div>
      <h3>${escapeHtml(newTool.name)}</h3>
      <p>${escapeHtml(newTool.neighborhood)} - ${escapeHtml(newTool.dailyPrice)} - ${escapeHtml(newTool.weekendPrice)}</p>
      <button type="button">View Tool</button>
    `;

    const newViewButton = newToolCard.querySelector("button");

    newViewButton.addEventListener("click", function () {
      showToolDetails(newTool);
    });

    toolGrid.appendChild(newToolCard);

    listingPreview.innerHTML = "";
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

renderRequestList();
