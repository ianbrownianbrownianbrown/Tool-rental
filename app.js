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
      <div class="tool-image">${toolCategory || "New Listing"}</div>
      <h3>${toolName || "Untitled Tool"}</h3>
      <p>${toolNeighborhood || "Grand Rapids"} - ${toolDailyPrice || "$0/day"} - ${toolWeekendPrice || "$0/weekend"}</p>
      <p>${toolDescription || "No description yet."}</p>
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
      <div class="tool-image">${newTool.category}</div>
      <h3>${newTool.name}</h3>
      <p>${newTool.neighborhood} - ${newTool.dailyPrice} - ${newTool.weekendPrice}</p>
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
  const requestTool = document.querySelector("#requestTool").value;
  const requestDate = document.querySelector("#requestDate").value;
  const requestNeighborhood = document.querySelector("#requestNeighborhood").value;
  const requestBudget = document.querySelector("#requestBudget").value;
  const requestNotes = document.querySelector("#requestNotes").value;
  const requestPreview = document.querySelector("#requestPreview");

  requestPreview.innerHTML = `
    <article class="tool-card preview-card">
      <div class="tool-image">Request</div>
      <h3>${requestTool || "Untitled Request"}</h3>
      <p>${requestNeighborhood || "Grand Rapids"} - ${requestDate || "Flexible timing"} - ${requestBudget || "Budget open"}</p>
      <p>${requestNotes || "No extra details yet."}</p>
      <button type="button">Request Looks Good</button>
    </article>
  `;
});