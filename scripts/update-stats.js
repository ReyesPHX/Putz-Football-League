const fs = require("fs");

const roster = JSON.parse(
  fs.readFileSync("data/roster.json", "utf8")
);

const output = {
  lastUpdated: new Date().toISOString(),
  season: 2026,
  week: 1,
  players: roster.map((player) => ({
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
