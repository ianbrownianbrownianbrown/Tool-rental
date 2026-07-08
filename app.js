const tools = {
  drill: {
    name: "Cordless Drill Kit",
    neighborhood: "Eastown",
    dailyPrice: "$12/day",
    weekendPrice: "$25/weekend",
    deposit: "$30 deposit",
    owner: "Marcus · 4.9 stars",
    included: "Two batteries, charger, bit set, and carrying case.",
  },

  ladder: {
    name: "Extension Ladder",
    neighborhood: "Alger Heights",
    dailyPrice: "$18/day",
    weekendPrice: "$40/weekend",
    deposit: "$50 deposit",
    owner: "Jenna · 5.0 stars",
    included: "Twenty-four foot extension ladder with stabilizer.",
  },

  sander: {
    name: "Floor Sander",
    neighborhood: "Heritage Hill",
    dailyPrice: "$35/day",
    weekendPrice: "$80/weekend",
    deposit: "$100 deposit",
    owner: "Rob · 4.8 stars",
    included: "Floor sander, dust bag, and starter sanding pads.",
  },

  scanner: {
    name: "OBD2 Scanner",
    neighborhood: "Kentwood",
    dailyPrice: "$10/day",
    weekendPrice: "$20/weekend",
    deposit: "$20 deposit",
    owner: "Alisha · 4.9 stars",
    included: "OBD2 scanner with basic code lookup guide.",
  },
};

const viewToolButtons = document.querySelectorAll(".tool-card button");
const previewListingButton = document.querySelector("#list button");
const postRequestButton = document.querySelector("#request button");

viewToolButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const toolKey = button.dataset.tool;
    const tool = tools[toolKey];

    alert(
      tool.name +
        "\n" +
        tool.neighborhood +
        "\n" +
        tool.dailyPrice +
        " · " +
        tool.weekendPrice +
        "\n" +
        tool.deposit +
        "\n" +
        tool.owner +
        "\n\nIncluded: " +
        tool.included
    );
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
      <p>${toolNeighborhood || "Grand Rapids"} · ${toolDailyPrice || "$0/day"} · ${toolWeekendPrice || "$0/weekend"}</p>
      <p>${toolDescription || "No description yet."}</p>
      <button type="button">Looks Good</button>
    </article>
  `;
});

postRequestButton.addEventListener("click", function () {
  alert("Your tool request would be posted here.");
});