const fs = require('fs');

// Read the original data and recommended swaps
const pcData = JSON.parse(fs.readFileSync('combined_cleaned_TCPD.json', 'utf-8'));
const pcToAssembly = JSON.parse(fs.readFileSync('pc_to_assembly.json', 'utf-8'));
const recommendedSwaps = JSON.parse(fs.readFileSync('recommended_swaps.json', 'utf-8'));

// Helper: Convert to number safely
function toNumber(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace(/,/g, '').trim()) || 0;
    return 0;
}

// Rebuild the PC and assembly details
const pcDetails = {};
const assemblyDetails = {};

// Initialize pcDetails and assemblyDetails from original data
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

// Function to calculate winner based on votes
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

// Create a mapping of new PC to assemblies after the swap
const newPCAssemblies = {};

// Apply the recommended swaps
for (const swap of recommendedSwaps) {
    const { fromPC, fromAssembly, toPC, toAssembly } = swap;

    // Update the assemblies for the PCs involved in the swap
    if (!newPCAssemblies[fromPC]) newPCAssemblies[fromPC] = [];
    if (!newPCAssemblies[toPC]) newPCAssemblies[toPC] = [];

    // Remove the swapped assemblies from the original PCs and add them to the new ones
    newPCAssemblies[fromPC] = newPCAssemblies[fromPC].filter(assemblyNo => assemblyNo !== fromAssembly);
    newPCAssemblies[toPC].push(fromAssembly);

    newPCAssemblies[toPC] = newPCAssemblies[toPC].filter(assemblyNo => assemblyNo !== toAssembly);
    newPCAssemblies[fromPC].push(toAssembly);
}

// Verify the vote counts for each PC after the swap
console.log("\n=== Verification Report ===");
let totalVotesVerified = 0;
let totalDiscrepancies = 0;

for (const [pcNo, assemblies] of Object.entries(newPCAssemblies)) {
    const pcNoInt = toNumber(pcNo);
    const currentWinner = pcDetails[pcNoInt]?.Winning_Party || "Unknown";

    console.log(`\nVerifying PC ${pcNoInt} (current winner: ${currentWinner})...`);
    const result = calculateWinner(assemblies);
    const newWinner = result.winner;

    console.log(`Current votes: ${JSON.stringify(result.allVotes)}`);
    console.log(`New winner after swap: ${newWinner}`);

    if (newWinner !== currentWinner) {
        console.log(`Discrepancy found: Winner has changed from ${currentWinner} to ${newWinner}`);
        totalDiscrepancies += 1;
    }

    totalVotesVerified += result.votes;
}

console.log("\n=== Verification Summary ===");
console.log(`Total verified votes across all PCs: ${totalVotesVerified}`);
console.log(`Total discrepancies (where winner has changed): ${totalDiscrepancies}`);

fs.writeFileSync('verification_report.json', JSON.stringify({
    totalVotesVerified,
    totalDiscrepancies
}, null, 2), 'utf-8');
