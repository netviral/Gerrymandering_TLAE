const fs = require('fs');

// Step 1: Read input files
const rawData = fs.readFileSync('cleaned_TCPD.json');
const data = JSON.parse(rawData);

const pcToAssembly = JSON.parse(fs.readFileSync('pc_to_assembly.json'));
const assemblyNeighbors = JSON.parse(fs.readFileSync('assembly_neighbors.json')); // 🔥 Add neighbors file

// Step 2: Reverse the pc_to_assembly mapping
const assemblyToPc = {};

for (const [pc, assemblies] of Object.entries(pcToAssembly)) {
  assemblies.forEach(assemblyNo => {
    assemblyToPc[assemblyNo] = parseInt(pc); // Save PC number as number
  });
}

// Step 3: Group by Assembly_No
const assemblyMap = {};

data.forEach(record => {
  const assemblyNo = record.Assembly_No;

  if (!assemblyMap[assemblyNo]) {
    assemblyMap[assemblyNo] = {
      Assembly_No: assemblyNo,
      Valid_Votes: parseInt(record.Valid_Votes),
      Electors: parseInt(record.Electors),
      Winning_Party: "",
      Winning_Margin: "",
      Winning_Margin_Percentage: "",
      Constituency_Type: record.Constituency_Type,
      Candidates: []
    };
  }

  if (record.Candidate_Position === "1") {
    assemblyMap[assemblyNo].Winning_Party = record.Party;
    assemblyMap[assemblyNo].Winning_Margin = record.Margin;
    assemblyMap[assemblyNo].Winning_Margin_Percentage = record.Margin_Percentage;
  }

  assemblyMap[assemblyNo].Candidates.push({
    Party: record.Party,
    Votes: parseInt(record.Votes),
    Vote_Share_Percentage: record.Vote_Share_Percentage,
    Margin: record.Margin,
    Margin_Percentage: record.Margin_Percentage,
    Candidate_Position: record.Candidate_Position
  });
});

// Step 4: Attach PC_Number to each Assembly
const assembliesWithPc = Object.values(assemblyMap).map(assembly => {
  const assemblyNo = parseInt(assembly.Assembly_No);
  if (assemblyToPc[assemblyNo]) {
    assembly.PC_Number = assemblyToPc[assemblyNo];
  } else {
    console.warn(`No PC found for Assembly_No: ${assemblyNo}`);
  }
  return assembly;
});

// Step 5: Group by PC_Number
const pcMap = {};

assembliesWithPc.forEach(assembly => {
  const pcNo = assembly.PC_Number;
  if (!pcMap[pcNo]) {
    pcMap[pcNo] = {
      PC_Number: pcNo,
      Assemblies: []
    };
  }
  
  delete assembly.PC_Number;
  
  // Add Assembly
  pcMap[pcNo].Assemblies.push(assembly);
});

// 🔥 Abstracted Step: Function to calculate PC results
function calculatePcResults(assemblies) {
  const result = {
    Valid_Votes: 0,
    Electors: 0,
    Winning_Party: "",
    Winning_Margin: "",
    Winning_Margin_Percentage: ""
  };

  const partyVoteTotals = {};

  assemblies.forEach(assembly => {
    result.Valid_Votes += assembly.Valid_Votes;
    result.Electors += assembly.Electors;

    assembly.Candidates.forEach(candidate => {
      const party = candidate.Party;
      const votes = candidate.Votes;

      if (!partyVoteTotals[party]) {
        partyVoteTotals[party] = 0;
      }
      partyVoteTotals[party] += votes;
    });
  });

  const sortedParties = Object.entries(partyVoteTotals)
    .sort((a, b) => b[1] - a[1]); // sort descending by votes

  if (sortedParties.length > 0) {
    const winningParty = sortedParties[0][0];
    const winningVotes = sortedParties[0][1];
    const runnerUpVotes = sortedParties[1] ? sortedParties[1][1] : 0;

    const margin = winningVotes - runnerUpVotes;
    const marginPercentage = (margin / result.Valid_Votes * 100).toFixed(2);

    result.Winning_Party = winningParty;
    result.Winning_Margin = margin.toString();
    result.Winning_Margin_Percentage = marginPercentage;
  }

  // Convert to string for consistency
  result.Valid_Votes = result.Valid_Votes.toString();
  result.Electors = result.Electors.toString();

  return result;
}

// Step 6: Build final PC objects
const finalOutput = Object.values(pcMap).map(pc => {
  const pcResults = calculatePcResults(pc.Assemblies);

  return {
    PC_Number: pc.PC_Number,
    ...pcResults,
    swappable_neighbors: "",
    Assemblies: pc.Assemblies
  };
});

// 🔥 Step 6.5: Add swappable_neighbors
finalOutput.forEach(pc => {
  const assembliesInPc = pc.Assemblies.map(a => parseInt(a.Assembly_No));
  const assembliesSet = new Set(assembliesInPc);

  const potentialNeighbors = new Set();

  assembliesInPc.forEach(assemblyNo => {
    const neighbors = assemblyNeighbors[assemblyNo] || [];

    neighbors.forEach(neighborAssemblyNo => {
      if (!assembliesSet.has(neighborAssemblyNo)) {
        potentialNeighbors.add(neighborAssemblyNo);
      }
    });
  });

  pc.swappable_neighbors = Array.from(potentialNeighbors).map(String);
});

// Step 7: Save to file
fs.writeFileSync('combined_cleaned_TCPD.json', JSON.stringify(finalOutput, null, 2));

console.log('✅ Done! Saved to combined_cleaned_TCPD.json');
