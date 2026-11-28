import { execSync } from 'node:child_process';

// Firebase web configuration is public client metadata. Keep the production
// project selection explicit and pass the values only to this build.
const project = 'double-game-dd845';
const appId = '1:30712897328:web:d361bc3b95308fea4772f5';
const response = execSync(`firebase apps:sdkconfig WEB ${appId} --project ${project} --json`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const config = JSON.parse(response).result.sdkConfig;
if (config.projectId !== project || config.appId !== appId) throw new Error('Unexpected Firebase web app');
const env = { ...process.env, VITE_BASE_PATH: '/', VITE_PREVIEW_MODE: 'false',
  VITE_BUILD_VERSION: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() };
for (const [name, field] of Object.entries({ API_KEY: 'apiKey', AUTH_DOMAIN: 'authDomain',
  PROJECT_ID: 'projectId', STORAGE_BUCKET: 'storageBucket', MESSAGING_SENDER_ID: 'messagingSenderId', APP_ID: 'appId' })) {
  if (typeof config[field] !== 'string' || !config[field]) throw new Error('Missing Firebase web configuration: ' + field);
  env['VITE_FIREBASE_' + name] = config[field];
}
execSync('npm run build', { stdio: 'inherit', env });
execSync('node scripts/check-bundle-budget.mjs', { stdio: 'inherit', env });
