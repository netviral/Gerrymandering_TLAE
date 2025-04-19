const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// === Configuration ===
const inputFile = 'TCPD_AE_Maharashtra_2025-4-15.csv';          // replace with your CSV filename
const outputFile = 'cleaned_TCPD.json';       // or change output name as needed
// === Fields to Keep (and Rename if Needed) ===

const fieldMap = {
    "Constituency_No": "Assembly_No",  // <== Rename happens here
    "Party": "Party",
    "Votes": "Votes",
    "Valid_Votes": "Valid_Votes",
    "Vote_Share_Percentage": "Vote_Share_Percentage",
    "Electors": "Electors",
    "Constituency_Type": "Constituency_Type",
    "Turnout_Percentage": "Turnout_Percentage",
    "Margin": "Margin",
    "Margin_Percentage": "Margin_Percentage"
  };
  
  // === Transform Logic ===
  const results = [];
  
  fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
      const filtered = {};
      for (const [original, renamed] of Object.entries(fieldMap)) {
        if (row[original] !== undefined) {
          filtered[renamed] = row[original];
        }
      }
      results.push(filtered);
    })
    .on('end', () => {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`✅ JSON saved to ${outputFile}`);
      for(var i=0;i<10000000000;i++){
        console.log(i)
      }
    });