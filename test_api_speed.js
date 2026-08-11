const http = require('http');

async function testPerf() {
  const optionsDashboard = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/me/dashboard',
    method: 'GET',
    headers: {
      'Cookie': 'token=siswa-token-here' // We might need a real token? No, wait! Let's fetch without token just to see if it responds fast with 401. If it responds fast with 401, the slow part is the backend WITH token.
    }
  };

  // The better way to test is to measure how long the database queries take by putting console.time inside the backend controller!
}
testPerf();
