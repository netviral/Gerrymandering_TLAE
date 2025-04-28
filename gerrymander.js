const fs = require('fs');

// Input: Target party
const targetParty = "INC";  // <-- Change as needed
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

// Create swappable_neighbors property if missing
// This is a simplified approach - in reality, you'd use geographic data
console.log("Generating neighbor relationships...");
const pcAssemblies = {};

// First, organize assemblies by PC
for (const [pcNoStr, assemblies] of Object.entries(pcToAssembly)) {
    const pcNo = toNumber(pcNoStr);
    pcAssemblies[pcNo] = assemblies.map(asmNo => toNumber(asmNo));
}

// For each PC, find adjacent PCs (simplified)
const adjacentPCs = {};
for (const pcNo of Object.keys(pcAssemblies).map(Number)) {
    adjacentPCs[pcNo] = [];
    // Simple logic: PCs with consecutive numbers might be adjacent
    // Replace with real adjacency data if available
    if (pcDetails[pcNo-1]) adjacentPCs[pcNo].push(pcNo-1);
    if (pcDetails[pcNo+1]) adjacentPCs[pcNo].push(pcNo+1);
}

// Set swappable_neighbors for each assembly
for (const [assemblyNoStr, assembly] of Object.entries(assemblyDetails)) {
    const assemblyNo = toNumber(assemblyNoStr);
    
    // Find which PC this assembly belongs to
    let thisPC = null;
    for (const [pcNoStr, assemblies] of Object.entries(pcToAssembly)) {
        if (assemblies.map(Number).includes(assemblyNo)) {
            thisPC = toNumber(pcNoStr);
            break;
        }
    }
    
    if (thisPC) {
        // Find neighboring assemblies from adjacent PCs
        assembly.swappable_neighbors = [];
        
        for (const neighborPC of adjacentPCs[thisPC] || []) {
            if (pcToAssembly[neighborPC]) {
                assembly.swappable_neighbors.push(...pcToAssembly[neighborPC].map(Number));
            }
        }
    }
}


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

    return { winner: winnerParty, votes: maxVotes, allVotes: partyVotes };
}

// Main Simulation
console.log("\nBeginning redistricting simulation...");
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

    // Calculate current vote margin
    const currentResult = calculateWinner(assemblies);
    console.log(`Current votes in PC ${pcNo}: `, currentResult.allVotes);
    
    for (const assemblyNo of assemblies.map(Number)) {
        if (usedAssemblies.has(assemblyNo)) continue;
        const assembly = assemblyDetails[assemblyNo];
        if (!assembly) {
            console.log(`Assembly ${assemblyNo} details not found`);
            continue;
        }

        if (!assembly.swappable_neighbors || assembly.swappable_neighbors.length === 0) {
            console.log(`Assembly ${assemblyNo} has no swappable neighbors`);
            continue;
        }

        console.log(`Assembly ${assemblyNo} has ${assembly.swappable_neighbors.length} possible neighbors to swap with`);

        for (const neighborNo of assembly.swappable_neighbors) {
            if (usedAssemblies.has(neighborNo)) continue;

            const neighborAssembly = assemblyDetails[neighborNo];
            if (!neighborAssembly) {
                console.log(`Neighbor assembly ${neighborNo} not found in data`);
                continue;
            }

            // Find the PCs they belong to
            let neighborPC = null;
            for (const [otherPC, otherAssemblies] of Object.entries(pcToAssembly)) {
                if (otherAssemblies.map(Number).includes(neighborNo)) {
                    neighborPC = toNumber(otherPC);
                    break;
                }
            }
            
            if (neighborPC === null) {
                console.log(`Could not find PC for assembly ${neighborNo}`);
                continue;
            }

            // Don't swap if neighboring PC is already won by target party
            if (pcDetails[neighborPC]?.Winning_Party === targetParty) {
                continue;
            }

            console.log(`Trying swap: Assembly ${assemblyNo} (PC ${pcNo}) <-> Assembly ${neighborNo} (PC ${neighborPC})`);

            // Prepare new assembly sets
            const newAssembliesPC = assemblies.filter(x => toNumber(x) !== assemblyNo).concat(neighborNo);
            const newAssembliesNeighbor = (pcToAssembly[neighborPC] || []).filter(x => toNumber(x) !== neighborNo).concat(assemblyNo);

            // Simulate
            const newWinnerPC = calculateWinner(newAssembliesPC);
            const newWinnerNeighbor = calculateWinner(newAssembliesNeighbor);

            console.log(`Post-swap winners: PC ${pcNo}: ${newWinnerPC.winner}, PC ${neighborPC}: ${newWinnerNeighbor.winner}`);
            
            // More relaxed criteria: Accept if at least one PC flips to target party without any loss
            let seatsGained = 0;
            
            if (newWinnerPC.winner === targetParty && pcDetails[pcNo].Winning_Party !== targetParty) {
                seatsGained += 1;
            }
            
            if (newWinnerNeighbor.winner === targetParty && pcDetails[neighborPC].Winning_Party !== targetParty) {
                seatsGained += 1;
            }
            
            // Don't accept if we lose any existing seats
            if ((pcDetails[pcNo].Winning_Party === targetParty && newWinnerPC.winner !== targetParty) ||
                (pcDetails[neighborPC].Winning_Party === targetParty && newWinnerNeighbor.winner !== targetParty)) {
                seatsGained = 0;  // Cancel if we lose seats
            }

            if (seatsGained > 0) {
                // Good swap!
                recommendedSwaps.push({
                    fromPC: pcNo,
                    fromAssembly: assemblyNo,
                    toPC: neighborPC,
                    toAssembly: neighborNo,
                    seatsGained: seatsGained,
                    newPCWinner: newWinnerPC.winner,
                    newNeighborWinner: newWinnerNeighbor.winner
                });

                usedAssemblies.add(assemblyNo);
                usedAssemblies.add(neighborNo);
                totalSeatsFlipped += seatsGained;

                console.log(`✅ Successful swap! Gained ${seatsGained} seat(s) for ${targetParty}`);
                break; // Move to next seat
            }
        }
        
        if (usedAssemblies.has(assemblyNo)) {
            break; // We found a swap for this PC, move to next PC
        }
    }
}

// Update the pcToAssembly dictionary with the new assemblies after swaps
for (const swap of recommendedSwaps) {
  const { fromPC, fromAssembly, toPC, toAssembly } = swap;

  // Swap assembly from one PC to another in the pcToAssembly structure
  const fromPCAssemblies = pcToAssembly[fromPC];
  const toPCAssemblies = pcToAssembly[toPC];

  // Remove the assembly from its original PC and add it to the new one
  const indexFrom = fromPCAssemblies.indexOf(fromAssembly);
  if (indexFrom !== -1) fromPCAssemblies.splice(indexFrom, 1);
  if (!toPCAssemblies.includes(toAssembly)) toPCAssemblies.push(toAssembly);

  const indexTo = toPCAssemblies.indexOf(toAssembly);
  if (indexTo !== -1) toPCAssemblies.splice(indexTo, 1);
  if (!fromPCAssemblies.includes(fromAssembly)) fromPCAssemblies.push(fromAssembly);
}

// Save the new pcToAssembly dictionary to a JSON file for manual verification
fs.writeFileSync('new_pc_to_assemblies.json', JSON.stringify(pcToAssembly, null, 2), 'utf-8');
console.log("Updated pcToAssembly saved to 'new_pc_to_assemblies.json'");


console.log("\n=== Final Report ===");
console.log(`Total Seats Flipped by Redistricting: ${totalSeatsFlipped}`);

// Save the recommended swaps to a JSON file
fs.writeFileSync('recommended_swaps.json', JSON.stringify(recommendedSwaps, null, 2), 'utf-8');

