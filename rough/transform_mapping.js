const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const inputCsv = 'Maharashtra_Constituencies.csv';
const outputJson = 'pc_to_assembly.json';

const pcToAssembly = {};

fs.createReadStream(inputCsv)
  .pipe(csv())
  .on('data', (row) => {
    const pcNo = parseInt(row.PC_No);
    const assemblyNo = parseInt(row.Assembly_No);

    if (!isNaN(pcNo) && !isNaN(assemblyNo)) {
      if (!pcToAssembly[pcNo]) {
        pcToAssembly[pcNo] = [];
      }
      pcToAssembly[pcNo].push(assemblyNo);
    }
  })
  .on('end', () => {
    // Optional: sort assembly numbers
    for (const pc in pcToAssembly) {
      pcToAssembly[pc].sort((a, b) => a - b);
    }

    fs.writeFileSync(outputJson, JSON.stringify(pcToAssembly, null, 2));
    console.log(`JSON saved to ${outputJson}`);
  });
