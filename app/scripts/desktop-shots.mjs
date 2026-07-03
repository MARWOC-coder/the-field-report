// Desktop screenshot pass: Log, Board, Me, Team at 1440x900.
// Usage: node scripts/desktop-shots.mjs <email> <password> [screenshotDir]
import { chromium } from 'playwright';

const [email, password, shotDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

await page.goto('http://localhost:4173/');
await page.waitForSelector('input[type=email]', { timeout: 15000 });
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button:has-text("Report In")');
await page.waitForSelector('text=Daily Activity', { timeout: 20000 });
await page.waitForTimeout(1400);
await page.screenshot({ path: `${shotDir}/desk-1-log.png` });

await page.click('a[href="#/board"]');
await page.waitForSelector('.board-row, .podium', { timeout: 15000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shotDir}/desk-2-board.png` });

await page.click('a[href="#/me"]');
await page.waitForSelector('.rank-hero', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${shotDir}/desk-3-me.png` });

await page.click('a[href="#/team"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${shotDir}/desk-4-team.png` });

await browser.close();
console.log('DESKTOP SHOTS DONE');
