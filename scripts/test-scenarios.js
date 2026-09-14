const { execSync } = require('child_process');
const path = require('path');

try {
  const runnerPath = path.join(__dirname, 'test-scenarios-runner.ts');
  execSync(`npx tsx "${runnerPath}"`, { stdio: 'inherit', cwd: process.cwd() });
} catch (err) {
  process.exit(1);
}
