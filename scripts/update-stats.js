const fs = require("fs");

const rosterData = JSON.parse(
  fs.readFileSync("data/roster.json", "utf8")
);

const roster = rosterData.players || [];

const now = new Date().toLocaleString("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short"
});

const output = {
  league: rosterData.league || "Putz Football League",
  teamName: rosterData.teamName || "Boston Bastards",
  lastUpdated: `${now} ET`,
  season: 2026,
  week: 1,
  players: roster.map((player) => ({
    slot: player.slot,
    name: player.name,
    position: player.position,
    team: player.team,
    opponent: "—",
    gameStatus: "Data provider not connected",
    statLine: "No game stats yet"
  }))
};

fs.writeFileSync(
  "data/latest-stats.json",
  JSON.stringify(output, null, 2) + "\n"
);
);
