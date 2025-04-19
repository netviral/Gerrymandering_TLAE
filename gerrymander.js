const fs = require("fs");
const Papa = require("papaparse");

// Load CSVs
function loadCSVSync(filename) {
  const file = fs.readFileSync(filename, "utf8");
  const parsed = Papa.parse(file, { header: true, skipEmptyLines: true });
  return parsed.data;
}

const neighbors = JSON.parse(fs.readFileSync("neighbors.json", "utf8"));
const constituencyMeta = loadCSVSync("Maharashtra_Constituencies.csv");
const electionDataRaw = loadCSVSync("TCPD_AE_Maharashtra_2025-4-15.csv");

// Normalize election data
const electionData = electionDataRaw.map(row => ({
  Assembly_No: parseInt(row.Assembly_No),
  PC_No: row.Constituency_No,
  Position: parseInt(row.Position),
  Party: row.Party,
  Reserved: row.Constituency_Type,
  Votes: parseInt(row.Votes),
}));

// Get reservation type by Assembly_No
const reservationMap = {};
for (let row of constituencyMeta) {
  reservationMap[parseInt(row.Assembly_No)] = row.Reserved.trim();
}

// Utility
function getWinners(data) {
  const winners = {};
  for (let row of data) {
    if (row.Position === 1) {
      winners[row.Assembly_No] = row.Party;
    }
  }
  return winners;
}

function countWins(data, party) {
  const winners = getWinners(data);
  return Object.values(winners).filter(p => p === party).length;
}

function simulateSwap(data, fromAC, toAC) {
  return data.map(row => {
    if (row.Assembly_No === fromAC) return { ...row, Assembly_No: toAC };
    if (row.Assembly_No === toAC) return { ...row, Assembly_No: fromAC };
    return row;
  });
}

function gerrymander(party, data, maxSwaps = 1) {
  const originalWins = countWins(data, party);
  let best = originalWins;
  let bestData = data;

  const winners = getWinners(data);

  console.log("🔍 Starting simulation...");
  for (const [acStr, neighborList] of Object.entries(neighbors)) {
    const ac = parseInt(acStr);
    for (const neighbor of neighborList) {
      const reservedA = reservationMap[ac];
      const reservedB = reservationMap[neighbor];
      if (reservedA !== reservedB) continue; // respect reservation

      const swapped = simulateSwap(data, ac, neighbor);
      const winCount = countWins(swapped, party);

      if (winCount > best) {
        best = winCount;
        bestData = swapped;
        console.log(`✅ Better config: Swapped ${ac} with ${neighbor} ➜ ${winCount} wins`);
      } else {
        console.log(`🔁 Tried swap ${ac} ↔ ${neighbor} ➜ ${winCount} wins (no gain)`);
      }
    }
  }

  console.log("\n📊 Original Wins:", originalWins);
  console.log("📈 After Gerrymandering (max 1 swap):", best);
  console.log("📈 Net Gain:", best - originalWins);
}

const PARTY = "BJP";
gerrymander(PARTY, electionData, 2);
