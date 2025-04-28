const fs = require('fs');

// === CONFIGURATION ===
const targetParty = "SHS";
const maxSwapsPerPC = 1;

// === LOAD FILES ===
const pcData = JSON.parse(fs.readFileSync('combined_cleaned_TCPD.json', 'utf-8'));
const pcToAssembly = JSON.parse(fs.readFileSync('pc_to_assembly.json', 'utf-8'));

// === BUILD DICTIONARIES ===
const pcDetails = {};
const assemblyDetails = {};

function toNumber(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace(/,/g, '').trim()) || 0;
    return 0;
}

for (const pc of pcData) {
    const pcNo = toNumber(pc.PC_Number);
    pcDetails[pcNo] = pc;

    for (const assembly of pc.Assemblies) {
        const assemblyNo = toNumber(assembly.Assembly_No);
        assemblyDetails[assemblyNo] = assembly;
    }
}

console.log("Loaded PCs:", Object.keys(pcDetails).length);
console.log("Loaded Assemblies:", Object.keys(assemblyDetails).length);

// === HELPER FUNCTIONS ===

// Recalculate PC result after possible modification
function calculatePCWinner(assemblies) {
    const partyVotes = {};

    for (const assembly of assemblies) {
        if (!assembly.Candidates) continue;
        for (const candidate of assembly.Candidates) {
            if (!partyVotes[candidate.Party]) {
                partyVotes[candidate.Party] = 0;
            }
            partyVotes[candidate.Party] += toNumber(candidate.Votes);
        }
    }

    let winningParty = null;
    let maxVotes = -1;

    for (const [party, votes] of Object.entries(partyVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winningParty = party;
        }
    }

    return winningParty;
}

// Get Assemblies for a PC
function getAssembliesForPC(pcNo) {
    return pcToAssembly[pcNo] || [];
}

// Swap assemblies between PCs
function simulateSwap(pcAssembliesA, pcAssembliesB, swapOutAssemblyNo, swapInAssemblyNo) {
    // Get the current winners before swap
    const currentWinnerA = calculatePCWinner(pcAssembliesA.map(a => assemblyDetails[a]).filter(x => x));
    const currentWinnerB = calculatePCWinner(pcAssembliesB.map(a => assemblyDetails[a]).filter(x => x));

    // Perform the swap
    const newAssembliesA = pcAssembliesA.filter(a => a !== swapOutAssemblyNo);
    newAssembliesA.push(swapInAssemblyNo);

    const newAssembliesB = pcAssembliesB.filter(a => a !== swapInAssemblyNo);
    newAssembliesB.push(swapOutAssemblyNo);

    // Get the new winners after the swap
    const newWinnerA = calculatePCWinner(newAssembliesA.map(a => assemblyDetails[a]).filter(x => x));
    const newWinnerB = calculatePCWinner(newAssembliesB.map(a => assemblyDetails[a]).filter(x => x));

    return {
        currentWinnerA,
        currentWinnerB,
        newWinnerA,
        newWinnerB
    };
}

// === MAIN SIMULATION ===
const swapRecommendations = [];
const alreadySwappedPCs = new Set();

// Initial Target Party wins
let initialTargetWins = 0;
for (const pcNo in pcDetails) {
    const assemblies = getAssembliesForPC(pcNo).map(a => assemblyDetails[a]).filter(x => x);
    const winner = calculatePCWinner(assemblies);
    if (winner === targetParty) {
        initialTargetWins++;
    }
}

for (const pcNoStr of Object.keys(pcDetails)) {
    const pcNo = parseInt(pcNoStr);
    if (alreadySwappedPCs.has(pcNo)) continue;

    const assembliesInPC = getAssembliesForPC(pcNo);
    const currentAssemblies = assembliesInPC.map(a => assemblyDetails[a]).filter(x => x);
    const currentWinner = calculatePCWinner(currentAssemblies);

    if (currentWinner === targetParty) {
        continue; // Already won by target party
    }

    let foundSwap = false;

    for (const swapOutAssemblyNo of assembliesInPC) {
        if (foundSwap) break;

        const neighbors = Object.keys(pcToAssembly).filter(otherPC => parseInt(otherPC) !== pcNo);

        for (const neighborPCNoStr of neighbors) {
            const neighborPCNo = parseInt(neighborPCNoStr);
            if (alreadySwappedPCs.has(neighborPCNo)) continue;

            const assembliesInNeighbor = getAssembliesForPC(neighborPCNo);

            for (const swapInAssemblyNo of assembliesInNeighbor) {
                const { currentWinnerA, currentWinnerB, newWinnerA, newWinnerB } = simulateSwap(assembliesInPC, assembliesInNeighbor, swapOutAssemblyNo, swapInAssemblyNo);

                // Check gain
                let preWins = 0;
                if (calculatePCWinner(currentAssemblies) === targetParty) preWins++;
                const neighborAssemblies = assembliesInNeighbor.map(a => assemblyDetails[a]).filter(x => x);
                if (calculatePCWinner(neighborAssemblies) === targetParty) preWins++;

                let postWins = 0;
                if (newWinnerA === targetParty) postWins++;
                if (newWinnerB === targetParty) postWins++;

                if (postWins > preWins) {
                    swapRecommendations.push({
                        fromPC: pcNo,
                        toPC: neighborPCNo,
                        swapOutAssembly: swapOutAssemblyNo,
                        swapInAssembly: swapInAssemblyNo,
                        earlierWonByA: currentWinnerA,
                        earlierWonByB: currentWinnerB,
                        nowWonByA: newWinnerA,
                        nowWonByB: newWinnerB
                    });

                    alreadySwappedPCs.add(pcNo);
                    alreadySwappedPCs.add(neighborPCNo);
                    foundSwap = true;
                    break;
                }
            }

            if (foundSwap) break;
        }
    }
}

// === POST SWAP ANALYSIS ===
let finalTargetWins = 0;
const tempPCAssemblies = {};

// Copy initial
for (const pcNo in pcToAssembly) {
    tempPCAssemblies[pcNo] = [...pcToAssembly[pcNo]];
}

// Apply swaps
for (const swap of swapRecommendations) {
    tempPCAssemblies[swap.fromPC] = tempPCAssemblies[swap.fromPC].filter(a => a !== swap.swapOutAssembly);
    tempPCAssemblies[swap.fromPC].push(swap.swapInAssembly);

    tempPCAssemblies[swap.toPC] = tempPCAssemblies[swap.toPC].filter(a => a !== swap.swapInAssembly);
    tempPCAssemblies[swap.toPC].push(swap.swapOutAssembly);
}

// Recalculate wins
for (const pcNo in tempPCAssemblies) {
    const assemblies = tempPCAssemblies[pcNo].map(a => assemblyDetails[a]).filter(x => x);
    const winner = calculatePCWinner(assemblies);
    if (winner === targetParty) {
        finalTargetWins++;
    }
}

// === RESULTS ===
console.log(JSON.stringify(swapRecommendations, null, 2));
console.log(`Original ${targetParty} wins: ${initialTargetWins}`);
console.log(`Potential ${targetParty} wins after swaps: ${finalTargetWins}`);
console.log(`Total Gain: +${finalTargetWins - initialTargetWins}`);

// === SAVE NEW PC TO ASSEMBLY MAPPING ===
fs.writeFileSync('new_pc_to_assembly.json', JSON.stringify(tempPCAssemblies, null, 2));

// === BUILD PC NUMBER TO WINNING PARTY MAPPING ===
const pcToWinningParty = {};

for (const pcNo in tempPCAssemblies) {
    const assemblies = tempPCAssemblies[pcNo].map(a => assemblyDetails[a]).filter(x => x);
    const winner = calculatePCWinner(assemblies);
    pcToWinningParty[pcNo] = winner;
}

fs.writeFileSync('pc_to_winning_party.json', JSON.stringify(pcToWinningParty, null, 2));

// === ALSO SAVE SWAP RECOMMENDATIONS FOR RECORD ===
fs.writeFileSync('swap_recommendations.json', JSON.stringify(swapRecommendations, null, 2));

console.log("Files written: new_pc_to_assembly.json, pc_to_winning_party.json, swap_recommendations.json");
