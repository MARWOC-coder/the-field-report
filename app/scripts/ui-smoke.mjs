// UI smoke test: login → log KPIs → leaderboard. Run `npm run preview` first.
// Usage: node scripts/ui-smoke.mjs <email> <password> [screenshotDir]
import { chromium } from 'playwright';

const [email, password, shotDir = '.'] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node scripts/ui-smoke.mjs <email> <password> [screenshotDir]');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

await page.goto('http://localhost:4173/');
await page.waitForSelector('text=REQUEST ACCESS', { timeout: 15000 }).catch(() => {});
await page.waitForSelector('input[type=email]', { timeout: 15000 });
await page.waitForTimeout(800); // entrance animation
await page.screenshot({ path: `${shotDir}/shot-1-login.png` });

await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button:has-text("Report In")');
await page.waitForSelector('text=Daily Activity', { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${shotDir}/shot-2-log.png` });

// tap the first tally row's + button three times
const plus = page.locator('.tally-row').first().locator('.tally-btn.plus');
await plus.click();
await plus.click();
await plus.click();
await page.waitForTimeout(1500); // debounce + save

// leaderboard
await page.click('a[href="#/board"]');
await page.waitForSelector('.board-row', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${shotDir}/shot-3-board.png` });
const rows = await page.locator('.board-row .callsign').allTextContents();
console.log('BOARD ROWS:', JSON.stringify(rows));

// me page
await page.click('a[href="#/me"]');
await page.waitForSelector('.rank-hero', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${shotDir}/shot-4-me.png`, fullPage: true });

// team page
await page.click('a[href="#/team"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${shotDir}/shot-6-team.png` });

await browser.close();
console.log('UI SMOKE PASSED');
