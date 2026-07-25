/**
 * Deploy Firestore security rules + indexes to double-game-dd845.
 * Requires: firebase login (or FIREBASE_TOKEN env for CI).
 *
 * Usage: npm run deploy:firestore
 */
import { spawnSync } from 'node:child_process';

const project = process.env.FIREBASE_PROJECT_ID?.trim() || 'double-game-dd845';
const args = ['firebase-tools', 'deploy', '--only', 'firestore', '--project', project, '--non-interactive'];

console.log(`Deploying Firestore rules + indexes to project: ${project}`);
const result = spawnSync('npx', args, { stdio: 'inherit', shell: true });

if (result.status !== 0) {
  console.error('\nDeploy failed. Run once interactively:');
  console.error('  npx firebase-tools login');
  console.error('  npm run deploy:firestore');
  process.exit(result.status ?? 1);
}

console.log('\nFirestore deploy complete.');
