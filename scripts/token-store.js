import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '..', '.env');

export async function persistRefreshToken(newRefreshToken) {
  if (!newRefreshToken || typeof newRefreshToken !== 'string') return;

  await persistToEnv(newRefreshToken);
  await persistToGitHubSecret(newRefreshToken);
}

async function persistToEnv(token) {
  try {
    if (!fs.existsSync(ENV_PATH)) return;
    let lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
    const idx = lines.findIndex((l) => l.startsWith('LINKEDIN_REFRESH_TOKEN='));
    if (idx >= 0) {
      lines[idx] = `LINKEDIN_REFRESH_TOKEN=${token}`;
      fs.writeFileSync(ENV_PATH, lines.join('\n'));
      console.log('      ✓ Persisted new refresh token to local .env');
    }
  } catch (err) {
    console.log(`      ⚠ Could not persist to .env: ${String(err.message).slice(0, 100)}`);
  }
}

async function persistToGitHubSecret(token) {
  const pat = process.env.GH_SECRETS_PAT;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!pat || !repo) return;

  try {
    execSync(
      `gh secret set LINKEDIN_REFRESH_TOKEN --body "${token}" --repo "${repo}"`,
      { env: { ...process.env, GH_TOKEN: pat }, stdio: 'pipe' }
    );
    console.log('      ✓ Persisted new refresh token to GitHub secret');
  } catch (err) {
    console.log(`      ⚠ Could not persist to GitHub secret: ${String(err.message).slice(0, 150)}`);
  }
}