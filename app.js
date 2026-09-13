const rows = document.getElementById("player-rows");
const subtitle = document.getElementById("subtitle");
const positionFilter = document.getElementById("position-filter");
const search = document.getElementById("search");

let players = [];

function statusClass(status = "") {
  const value = status.toLowerCase();

  if (value.includes("final")) {
    return "status-final";
  }

  if (
    value.includes("quarter") ||
    value.includes("halftime") ||
    value.includes("live") ||
    value.includes("in progress")
  ) {
    return "status-live";
  }

  return "";
}

function render() {
  const position = positionFilter.value;
  const term = search.value.trim().toLowerCase();

  const visible = players.filter((player) => {
    const positionMatch =
      position === "ALL" || player.position === position;

    const searchableText =
      `${player.name} ${player.team} ${player.opponent}`.toLowerCase();

    return positionMatch && searchableText.includes(term);
  });

  if (!visible.length) {
    rows.innerHTML =
      `<tr><td colspan="6">No matching players.</td></tr>`;
    return;
  }

  rows.innerHTML = visible.map((player) => `
    <tr>
      <td>${player.position || "—"}</td>
      <td>${player.name || "—"}</td>
      <td>${player.team || "—"}</td>
      <td>${player.opponent || "—"}</td>
      <td class="${statusClass(player.gameStatus)}">
        ${player.gameStatus || "—"}
      </td>
      <td>${player.statLine || "No stats available"}</td>
    </tr>
  `).join("");
}

async function loadStats() {
  try {
    const response = await fetch(
      `data/latest-stats.json?cache=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error("Could not load stats.");
    }

    const data = await response.json();
    players = data.players || [];

    subtitle.textContent =
      `Season ${data.season || "—"} · Week ${data.week || "—"} · ` +
      `Last updated: ${data.lastUpdated || "Unknown"}`;

    render();
  } catch (error) {
    subtitle.textContent = "Unable to load player data.";
    rows.innerHTML =
      `<tr><td colspan="6">Check that data/latest-stats.json exists.</td></tr>`;
  }
}

positionFilter.addEventListener("change", render);
search.addEventListener("input", render);

loadStats();
