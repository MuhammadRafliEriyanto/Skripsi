const fs = require('fs');
const lines = fs.readFileSync('./src/components/dashboard-admin/AdminPaymentVerification.tsx', 'utf8').split('\n');
let newLines = [];

for(let i=0; i<lines.length; i++) {
  // Remove Tabs and TabsList
  if(i >= 956 && i <= 968) continue; 
  
  // Replace TabsContent massal with div
  if(i === 970) {
    newLines.push(lines[i].replace('<TabsContent value="massal"', '<div'));
    continue;
  }
  
  // Replace closing TabsContent for massal
  if(i === 1326) {
    newLines.push('              </div>');
    continue;
  }
  
  // Remove TabsContent individual entirely and </Tabs>
  if(i >= 1327 && i <= 1436) continue;
  
  newLines.push(lines[i]);
}

fs.writeFileSync('./src/components/dashboard-admin/AdminPaymentVerification.tsx', newLines.join('\n'));
console.log("Done");
