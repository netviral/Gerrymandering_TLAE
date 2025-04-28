const fs = require('fs');

// Read data files
const tcpdData = JSON.parse(fs.readFileSync('cleaned_TCPD.json', 'utf8'));
const neighborsData = JSON.parse(fs.readFileSync('assembly_neighbors.json', 'utf8'));
const pcData = JSON.parse(fs.readFileSync('pc_to_assembly.json', 'utf8'));

// Helper: Find winning candidate info by Assembly_No
const findWinner = (assemblyNo) => {
    return tcpdData.find(item => item.Assembly_No == assemblyNo && item.Candidate_Position == "1");
};

// Helper: Map Assembly_No -> PC
const assemblyToPC = {};
for (const [pc, assemblies] of Object.entries(pcData)) {
    assemblies.forEach(assemblyNo => {
        assemblyToPC[assemblyNo] = pc;
    });
}

// Step 1: Filter constituencies where margin <= 15% and Candidate_Position == 1
const filteredConstituencies = tcpdData.filter(c => {
    if (c.Candidate_Position !== "1") return false;
    if (parseFloat(c.Margin_Percentage) > 15) return false;

    const neighbors = neighborsData[c.Assembly_No];
    if (!neighbors) return false;

    for (let neighborNo of neighbors) {
        const neighborWinner = findWinner(neighborNo);
        if (!neighborWinner) continue;

        if (neighborWinner.Party !== c.Party) {
            return true; // Neighbor won by different party
        }
    }
    return false;
});

// Step 2: Save the filtered constituencies
fs.writeFileSync('filtered_constituencies.json', JSON.stringify(filteredConstituencies, null, 2));
console.log('Filtered constituencies saved to filtered_constituencies.json');

// Step 3: Now further filter for gerrymanderable based on margin comparison and PC difference
const gerrymanderable = [];

for (let constituency of filteredConstituencies) {
    const neighbors = neighborsData[constituency.Assembly_No];
    if (!neighbors) continue;

    const constituencyMargin = parseFloat(constituency.Margin_Percentage);
    const constituencyPC = assemblyToPC[constituency.Assembly_No];

    const possibleNeighbors = [];

    for (let neighborNo of neighbors) {
        const neighborWinner = findWinner(neighborNo);
        if (!neighborWinner) continue;

        if (neighborWinner.Party !== constituency.Party) {
            const neighborMargin = parseFloat(neighborWinner.Margin_Percentage);
            const neighborPC = assemblyToPC[neighborNo];

            if (neighborMargin > constituencyMargin && constituencyPC !== neighborPC) {
                possibleNeighbors.push({
                    Assembly_No: neighborWinner.Assembly_No,
                    Winning_Party: neighborWinner.Party,
                    Valid_Votes: neighborWinner.Valid_Votes,
                    Electors: neighborWinner.Electors,
                    Constituency_Type: neighborWinner.Constituency_Type,
                    Win_Margin: neighborWinner.Margin,
                    Win_Margin_Percentage: neighborWinner.Margin_Percentage,
                    PC_No: neighborPC
                });
            }
        }
    }

    if (possibleNeighbors.length > 0) {
        gerrymanderable.push({
            constituency: {
                Assembly_No: constituency.Assembly_No,
                Winning_Party: constituency.Party,
                Valid_Votes: constituency.Valid_Votes,
                Electors: constituency.Electors,
                Constituency_Type: constituency.Constituency_Type,
                Win_Margin: constituency.Margin,
                Win_Margin_Percentage: constituency.Margin_Percentage,
                PC_No: constituencyPC
            },
            neighbors: possibleNeighbors
        });
    }
}

// Step 4: Save gerrymanderable results
fs.writeFileSync('gerrymanderable.json', JSON.stringify(gerrymanderable, null, 2));
console.log('Gerrymanderable constituencies saved to gerrymanderable.json');
