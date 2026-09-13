const fs = require("fs");

const SEASON = 2026;
const STATS_URL =
  `https://github.com/nflverse/nflverse-data/releases/download/player_stats/stats_player_week_${SEASON}.csv`;

async function getCsv(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Putz-Football-League personal tracker"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not download player stats: ${response.status}`);
  }

  return response.text();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);

  if (!lines.length) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record;
  });
}

function splitCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(value);
      value = "";
      continue;
    }

    value += character;
  }

  values.push(value);

  return values;
}

function normalizeName(name = "") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTeam(team = "") {
  const map = {
    JAC: "JAX",
    LA: "LAR",
    LV: "LV",
    GB: "GB",
    NE: "NE",
    NO: "NO",
    SF: "SF",
    TB: "TB"
  };

  return map[String(team).toUpperCase()] || String(team).toUpperCase();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function shown(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function joinParts(parts) {
  return parts.filter(Boolean).join(", ");
}

function statLine(player, stat) {
  const position = player.position;

  const passComp = asNumber(stat.completions);
  const passAtt = asNumber(stat.attempts);
  const passYds = asNumber(stat.passing_yards);
  const passTd = asNumber(stat.passing_tds);
  const passInt = asNumber(stat.interceptions);

  const rushAtt = asNumber(stat.carries);
  const rushYds = asNumber(stat.rushing_yards);
  const rushTd = asNumber(stat.rushing_tds);

  const rec = asNumber(stat.receptions);
  const recYds = asNumber(stat.receiving_yards);
  const recTd = asNumber(stat.receiving_tds);
  const targets = asNumber(stat.targets);

  const tackles = asNumber(stat.def_tackles);
  const solo = asNumber(stat.def_tackles_solo);
  const assists = asNumber(stat.def_tackles_with_assist);
  const sacks = asNumber(stat.def_sacks);
  const tfl = asNumber(stat.def_tackles_for_loss);
  const interceptions = asNumber(stat.def_interceptions);
  const passesDefended = asNumber(stat.def_pass_defended);
  const forcedFumbles = asNumber(stat.def_forced_fumbles);
  const fumbleRecoveries = asNumber(stat.def_fumbles_recovered);
  const defensiveTds = asNumber(stat.def_tds);

  const offense = [];
  const defense = [];

  if (position === "QB") {
    offense.push(
      `${shown(passComp)}/${shown(passAtt)} pass`,
      `${shown(passYds)} yds`,
      `${shown(passTd)} TD`,
      `${shown(passInt)} INT`
    );

    if (rushAtt || rushYds || rushTd) {
      offense.push(
        `${shown(rushAtt)} rush`,
        `${shown(rushYds)} rush yds`,
        `${shown(rushTd)} rush TD`
      );
    }
  } else if (["RB", "WR", "TE"].includes(position)) {
    if (rushAtt || rushYds || rushTd) {
      offense.push(
        `${shown(rushAtt)} rush`,
        `${shown(rushYds)} rush yds`,
        `${shown(rushTd)} rush TD`
      );
    }

    if (rec || recYds || recTd || targets) {
      offense.push(
        `${shown(rec)} rec`,
        `${shown(recYds)} rec yds`,
        `${shown(recTd)} rec TD`
      );

      if (targets) {
        offense.push(`${shown(targets)} tgt`);
      }
    }
  }

  if (["DT", "DE", "DL", "ILB", "OLB", "DE-LB", "CB", "S"].includes(position)) {
    defense.push(
      `${shown(tackles)} tackles`,
      `(${shown(solo)} solo, ${shown(assists)} ast)`,
      `${shown(sacks)} sacks`,
      `${shown(tfl)} TFL`
    );

    if (interceptions) defense.push(`${shown(interceptions)} INT`);
    if (passesDefended) defense.push(`${shown(passesDefended)} PD`);
    if (forcedFumbles) defense.push(`${shown(forcedFumbles)} FF`);
    if (fumbleRecoveries) defense.push(`${shown(fumbleRecoveries)} FR`);
    if (defensiveTds) defense.push(`${shown(defensiveTds)} DEF TD`);
  }

  const line = joinParts([...offense, ...defense]);

  return line || "No recorded stats";
}

async function main() {
  const rosterData = JSON.parse(
    fs.readFileSync("data/roster.json", "utf8")
  );

  const roster = rosterData.players || [];
  const csvText = await getCsv(STATS_URL);
  const weeklyStats = parseCsv(csvText);

  const statsByPlayer = new Map();

  for (const stat of weeklyStats) {
    const name =
      stat.player_name ||
      stat.display_name ||
      stat.player_display_name ||
      "";

    const team =
      stat.recent_team ||
      stat.team ||
      stat.posteam ||
      "";

    const key = `${normalizeName(name)}|${normalizeTeam(team)}`;

    if (key !== "|") {
      statsByPlayer.set(key, stat);
    }
  }

  const latestWeek = weeklyStats.reduce((maxWeek, stat) => {
    const week = asNumber(stat.week);
    return Math.max(maxWeek, week);
  }, 0);

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short"
  });

  const output = {
    league: rosterData.league || "Putz Football League",
    teamName: rosterData.teamName || "Boston Bastards",
    lastUpdated: `${now} ET`,
    season: SEASON,
    week: latestWeek || "—",
    source: "nflverse weekly player stats",
    players: roster.map((player) => {
      const key =
        `${normalizeName(player.name)}|${normalizeTeam(player.team)}`;

      const stat = statsByPlayer.get(key);

      return {
        slot: player.slot,
        name: player.name,
        position: player.position,
        team: player.team,
        opponent: stat?.opponent_team || stat?.defteam || "—",
        gameStatus: stat
          ? `Week ${stat.week || latestWeek} final stats`
          : "No current-week stats found",
        statLine: stat ? statLine(player, stat) : "No recorded stats"
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
