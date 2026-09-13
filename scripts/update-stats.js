const fs = require("fs");

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50";

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Putz-Football-League personal tracker"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }

  return response.json();
}

function displayStatus(event) {
  const status = event.status?.type;

  if (!status) {
    return "No game status";
  }

  if (status.completed) {
    return "Final";
  }

  if (status.state === "pre") {
    return `Scheduled: ${status.detail || ""}`.trim();
  }

  return status.detail || "In progress";
}

function findTeamGame(events, nflTeam) {
  for (const event of events) {
    const competition = event.competitions?.[0];

    if (!competition) {
      continue;
    }

    const competitors = competition.competitors || [];
    const teamMatch = competitors.find(
      (competitor) => competitor.team?.abbreviation === nflTeam
    );

    if (teamMatch) {
      const opponent = competitors.find(
        (competitor) => competitor.team?.abbreviation !== nflTeam
      );

      return {
        eventId: event.id,
        opponent: opponent?.team?.abbreviation || "—",
        gameStatus: displayStatus(event)
      };
    }
  }

  return {
    eventId: null,
    opponent: "—",
    gameStatus: "No game scheduled"
  };
}

async function main() {
  const rosterData = JSON.parse(
    fs.readFileSync("data/roster.json", "utf8")
  );

  const roster = rosterData.players || [];
  const scoreboard = await getJson(SCOREBOARD_URL);
  const events = scoreboard.events || [];

  const gamesByTeam = {};

  for (const player of roster) {
    if (!gamesByTeam[player.team]) {
      gamesByTeam[player.team] = findTeamGame(events, player.team);
    }
  }

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short"
  });

  const output = {
    league: rosterData.league || "Putz Football League",
    teamName: rosterData.teamName || "Boston Bastards",
    lastUpdated: `${now} ET`,
    season: scoreboard.season?.year || 2026,
    week: scoreboard.week?.number || "—",
    players: roster.map((player) => {
      const game = gamesByTeam[player.team];

      return {
        slot: player.slot,
        name: player.name,
        position: player.position,
        team: player.team,
        opponent: game.opponent,
        gameStatus: game.gameStatus,
        eventId: game.eventId,
        statLine: "Player box-score stats will be added next"
      };
    })
  };

  fs.writeFileSync(
    "data/latest-stats.json",
    JSON.stringify(output, null, 2) + "\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
