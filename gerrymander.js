const fs = require('fs');

// Read and parse the files
const pcData = JSON.parse(fs.readFileSync('combined_cleaned_TCPD.json', 'utf-8'));
const pcToAssembly = JSON.parse(fs.readFileSync('pc_to_assembly.json', 'utf-8'));

// Build dictionaries for quick access
const pcDetails = {};
const assemblyDetails = {};

// Helper: Convert to number safely
function toNumber(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace(/,/g, '').trim()) || 0;
    return 0;
}

// Initialize pcDetails and assemblyDetails
for (const pc of pcData) {
    const pcNo = toNumber(pc.PC_Number);
    pc.Valid_Votes = toNumber(pc.Valid_Votes);
    pc.Electors = toNumber(pc.Electors);
    pc.Winning_Margin = toNumber(pc.Winning_Margin);
    pc.Winning_Margin_Percentage = parseFloat(pc.Winning_Margin_Percentage) || 0;
    
    pcDetails[pcNo] = pc;

    for (const assembly of pc.Assemblies) {
        const assemblyNo = toNumber(assembly.Assembly_No);
        assembly.Valid_Votes = toNumber(assembly.Valid_Votes);
        assembly.Electors = toNumber(assembly.Electors);
        assembly.Winning_Margin = toNumber(assembly.Winning_Margin);
        assembly.Winning_Margin_Percentage = parseFloat(assembly.Winning_Margin_Percentage) || 0;
        
        // Clean up candidate data
        if (assembly.Candidates) {
            for (const candidate of assembly.Candidates) {
                candidate.Votes = toNumber(candidate.Votes);
                candidate.Vote_Share_Percentage = parseFloat(candidate.Vote_Share_Percentage) || 0;
                candidate.Margin = toNumber(candidate.Margin);
                candidate.Margin_Percentage = parseFloat(candidate.Margin_Percentage) || 0;
            }
        }

        assemblyDetails[assemblyNo] = assembly;
    }
}

console.log("Loaded PCs:", Object.keys(pcDetails).length);
console.log("Loaded Assemblies:", Object.keys(assemblyDetails).length);

// Input: Target party
const targetParty = "SHS";  // <-- Change as needed

// Keep track of assemblies that have already been swapped
const usedAssemblies = new Set();
const recommendedSwaps = [];
let totalSeatsFlipped = 0;

// Helper to calculate who wins a PC given assemblies
function calculateWinner(assemblyNos) {
    const partyVotes = {};

    for (const assemblyNo of assemblyNos) {
        const assembly = assemblyDetails[assemblyNo];
        if (!assembly) continue;

        if (assembly.Candidates) {
            for (const candidate of assembly.Candidates) {
                if (!candidate.Party) continue;
                partyVotes[candidate.Party] = (partyVotes[candidate.Party] || 0) + candidate.Votes;
            }
        }
    }

    let maxVotes = -1;
    let winnerParty = null;

    for (const [party, votes] of Object.entries(partyVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winnerParty = party;
        }
    }

    return { winner: winnerParty, votes: maxVotes };
}

// Main Simulation
for (const [pcNoStr, pc] of Object.entries(pcDetails)) {
    const pcNo = toNumber(pcNoStr);

    if (pc.Winning_Party === targetParty) {
        console.log(`Skipping PC ${pcNo} (already won by ${targetParty})`);
        continue;
    }

    console.log(`Checking PC ${pcNo} (current winner: ${pc.Winning_Party})...`);

    const assemblies = pcToAssembly[pcNo];
    if (!assemblies) {
        console.log(`No assemblies found for PC ${pcNo}`);
        continue;
    }

    for (const assemblyNo of assemblies) {
        if (usedAssemblies.has(assemblyNo)) continue;
        const assembly = assemblyDetails[assemblyNo];
        if (!assembly) continue;

        if (!assembly.swappable_neighbors || assembly.swappable_neighbors.length === 0) {
          console.log(`Assembly ${assemblyNo} has no swappable neighbors`);
          console.log("Actual Assembly Object:", JSON.stringify(assembly, null, 2));  // <--- add this
          continue;
      }

        for (const neighborNoRaw of assembly.swappable_neighbors) {
            const neighborNo = toNumber(neighborNoRaw);
            if (usedAssemblies.has(neighborNo)) continue;

            const neighborAssembly = assemblyDetails[neighborNo];
            if (!neighborAssembly) continue;

            // Find the PCs they belong to
            let neighborPC = null;
            for (const [otherPC, assemblies] of Object.entries(pcToAssembly)) {
                if (assemblies.includes(neighborNo)) {
                    neighborPC = toNumber(otherPC);
                    break;
                }
            }
            if (neighborPC === null) continue;

            // Prepare new assembly sets
            const newAssembliesPC = assemblies.filter(x => x !== assemblyNo).concat(neighborNo);
            const newAssembliesNeighbor = (pcToAssembly[neighborPC] || []).filter(x => x !== neighborNo).concat(assemblyNo);

            // Simulate
            const newWinnerPC = calculateWinner(newAssembliesPC);
            const newWinnerNeighbor = calculateWinner(newAssembliesNeighbor);

            console.log(`Trying swap: Assembly ${assemblyNo} (PC ${pcNo}) <-> Assembly ${neighborNo} (PC ${neighborPC})`);
            console.log(`Post-swap winners: PC ${newWinnerPC.winner}, NeighborPC ${newWinnerNeighbor.winner}`);

            if (newWinnerPC.winner === targetParty && newWinnerNeighbor.winner === targetParty) {
                // Good swap!
                recommendedSwaps.push({
                    fromPC: pcNo,
                    fromAssembly: assemblyNo,
                    toPC: neighborPC,
                    toAssembly: neighborNo
                });

                usedAssemblies.add(assemblyNo);
                usedAssemblies.add(neighborNo);

                console.log(`Successful swap! PC ${pcNo} and PC ${neighborPC} both flipped to ${targetParty}`);
                totalSeatsFlipped += 2; // Two seats flipped
                break; // Move to next seat
            }
        }
    }
}

console.log("\n=== Final Report ===");
console.log(`Total Seats Flipped by Redistricting: ${totalSeatsFlipped}`);
console.log("Recommended Swaps:", JSON.stringify(recommendedSwaps, null, 2));
