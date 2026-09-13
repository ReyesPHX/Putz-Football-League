const fs = require("fs");

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

function normalizeName(name = "") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function numberAt(stats, index) {
  const value = stats?.[index];
  return value === undefined || value === null || value === ""
    ? "0"
    : String(value);
}

function addStat(stats, label, value) {
  if (value && value !== "0" && value !== "0-0") {
    stats.push(`${label} ${value}`);
  }
}

function statLineForPlayer(player, categoryMap) {
  const passing = categoryMap.passing?.get(player.matchKey);
  const rushing = categoryMap.rushing?.get(player.matchKey);
  const receiving = categoryMap.receiving?.get(player.matchKey);
  const defensive = categoryMap.defensive?.get(player.matchKey);

  const parts = [];

  if (passing) {
    const completions = numberAt(passing, 0);
    const attempts = numberAt(passing, 1);
    const yards = numberAt(passing, 3);
    const touchdowns = numberAt(passing, 5);
    const interceptions = numberAt(passing, 6);
    const sacks = numberAt(passing, 7);

    parts.push(
      `${completions}/${attempts} pass, ${yards} yds, ${touchdowns} TD, ${interceptions} INT, ${sacks} sacks`
    );
  }

  if (rushing) {
    const carries = numberAt(rushing, 0);
    const yards = numberAt(rushing, 1);
    const touchdowns = numberAt(rushing, 3);

    parts.push(`${carries} rush, ${yards} yds, ${touchdowns} TD`);
  }

  if (receiving) {
    const receptions = numberAt(receiving, 0);
    const yards = numberAt(receiving, 1);
    const touchdowns = numberAt(receiving, 3);
    const targets = numberAt(receiving, 4);

    let line = `${receptions} rec, ${yards} yds, ${touchdowns} TD`;

    if (targets !== "0") {
      line += `, ${targets} tgt`;
    }

    parts.push(line);
  }

  if (defensive) {
    const totalTackles = numberAt(defensive, 0);
    const soloTackles = numberAt(defensive, 1);
    const sacks = numberAt(defensive, 3);
    const interceptions = numberAt(defensive, 4);
    const passesDefended = numberAt(defensive, 5);
    const forcedFumbles = numberAt(defensive, 6);

    parts.push(
      `${totalTackles} tackles (${soloTackles} solo), ${sacks} sacks, ` +
      `${interceptions} INT, ${passesDefended} PD, ${forcedFumbles} FF`
    );
  }

  return parts.length ? parts.join("; ") : "No box-score stats recorded";
}

function addCategoryPlayers(categoryMap, categoryName, category) {
  const athletes = category?.athletes || [];

  for (const teamBlock of athletes) {
    for (const athlete of teamBlock.athletes || []) {
      const athleteName =
        athlete.athlete?.displayName ||
        athlete.athlete?.fullName ||
        athlete.athlete?.shortName ||
        "";

      const key = normalizeName(athleteName);

      if (!key) {
        continue;
      }

      categoryMap[categoryName].set(key, athlete.stats || []);
    }
  }
}

function parseBoxscore(summary) {
  const categoryMap = {
    passing: new Map(),
    rushing: new Map(),
    receiving: new Map(),
    defensive: new Map()
  };

  const players = summary.boxscore?.players || [];

  for (const team of players) {
    for (const category of team.statistics || []) {
      const categoryName = String(category.name || "").toLowerCase();

      if (categoryName === "passing") {
        addCategoryPlayers(categoryMap, "passing", category);
      }

      if (categoryName === "rushing") {
        addCategoryPlayers(categoryMap, "rushing", category);
      }

      if (categoryName === "receiving") {
        addCategoryPlayers(categoryMap, "receiving", category);
      }

      if (
        categoryName === "defensive" ||
        categoryName === "defense"
      ) {
        addCategoryPlayers(categoryMap, "defensive", category);
      }
    }
  }

  return categoryMap;
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

  const boxscoresByEvent = {};

  for (const game of Object.values(gamesByTeam)) {
    if (!game.eventId || boxscoresByEvent[game.eventId]) {
      continue;
    }

    const summaryUrl =
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=" +
      game.eventId;

    const summary = await getJson(summaryUrl);
    boxscoresByEvent[game.eventId] = parseBoxscore(summary);

    await sleep(250);
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
      const categoryMap = game.eventId
        ? boxscoresByEvent[game.eventId]
        : null;

      const rosterPlayer = {
        slot: player.slot,
        name: player.name,
        position: player.position,
        team: player.team,
        opponent: game.opponent,
        gameStatus: game.gameStatus,
        eventId: game.eventId
      };

      const matchKey = normalizeName(player.name);

      return {
        ...rosterPlayer,
        matchKey,
        statLine: categoryMap
          ? statLineForPlayer({ ...rosterPlayer, matchKey }, categoryMap)
          : "No game scheduled"
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
