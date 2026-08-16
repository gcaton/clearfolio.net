import { defineConfig } from '@playwright/test'

const DB_PATH = '/tmp/clearfolio-e2e.db'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: `rm -f ${DB_PATH} && npm run build && npm run db:migrate && npm run start -- --port 3100`,
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DB_PATH, CLEARFOLIO_SESSION_DAYS: '30' },
  },
})
