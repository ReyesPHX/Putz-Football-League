const fs = require("fs");

const API_KEY = process.env.SPORTS_DATA_IO_KEY;

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(
      `SportsDataIO request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function main() {
  if (!API_KEY) {
    throw new Error(
      "SPORTS_DATA_IO_KEY was not found. Check GitHub Actions secrets and workflow setup."
    );
  }

  const rosterData = JSON.parse(
    fs.readFileSync("data/roster.json", "utf8")
  );

  const roster = rosterData.players || [];

  const teamsUrl =
    "https://api.sportsdata.io/v3/nfl/scores/json/Teams";

  const teams = await getJson(teamsUrl);

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short"
  });

  const output = {
    league: rosterData.league || "Putz Football League",
    teamName: rosterData.teamName || "Boston Bastards",
    lastUpdated: `${now} ET`,
    source: "SportsDataIO connection verified",
    connectionStatus: "Success",
    message:
      `SportsDataIO connected successfully. Team records received: ${teams.length}.`,
    players: roster.map((player) => ({
      slot: player.slot,
      name: player.name,
      position: player.position,
      team: player.team,
      opponent: "—",
      gameStatus: "SportsDataIO connected",
      statLine: "Player-stat mapping is the next step"
    }))
  };

  fs.writeFileSync(
    "data/latest-stats.json",
    JSON.stringify(output, null, 2) + "\n"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
