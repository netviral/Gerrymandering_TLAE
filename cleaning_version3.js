const fs = require('fs');

// Step 1: Read input files
const rawData = fs.readFileSync('cleaned_TCPD.json');
const data = JSON.parse(rawData);

const pcToAssembly = JSON.parse(fs.readFileSync('pc_to_assembly.json'));

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
      Assemblies: [],
      Valid_Votes: 0,
      Electors: 0,
      Party_Vote_Totals: {} // Temp storage for party wise vote totals
    };
  }
  delete assembly.PC_Number;
  
  // Add Assembly
  pcMap[pcNo].Assemblies.push(assembly);

  // Update Valid Votes and Electors
  pcMap[pcNo].Valid_Votes += assembly.Valid_Votes;
  pcMap[pcNo].Electors += assembly.Electors;

  // Update Party vote totals
  assembly.Candidates.forEach(candidate => {
    const party = candidate.Party;
    const votes = candidate.Votes;
    if (!pcMap[pcNo].Party_Vote_Totals[party]) {
      pcMap[pcNo].Party_Vote_Totals[party] = 0;
    }
    pcMap[pcNo].Party_Vote_Totals[party] += votes;
  });
});

// Step 6: Calculate Winning_Party and Margin per PC
const finalOutput = Object.values(pcMap).map(pc => {
  const partyVotes = pc.Party_Vote_Totals;
  
  const sortedParties = Object.entries(partyVotes)
    .sort((a, b) => b[1] - a[1]); // sort descending by votes

  const winningParty = sortedParties[0][0];
  const winningVotes = sortedParties[0][1];
  const runnerUpVotes = sortedParties[1] ? sortedParties[1][1] : 0; // handle if no runner-up

  const margin = winningVotes - runnerUpVotes;
  const marginPercentage = (margin / pc.Valid_Votes * 100).toFixed(2);

  return {
    PC_Number: pc.PC_Number,
    Valid_Votes: pc.Valid_Votes.toString(),
    Electors: pc.Electors.toString(),
    Winning_Party: winningParty,
    Winning_Margin: margin.toString(),
    Winning_Margin_Percentage: marginPercentage,
    Assemblies: pc.Assemblies
  };
});

// Step 7: Save to file
fs.writeFileSync('combined_cleaned_TCPD.json', JSON.stringify(finalOutput, null, 2));

console.log('✅ Done! Saved to combined_cleaned_TCPD.json');
