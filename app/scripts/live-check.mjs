// Live smoke: load the production URL, sign in, confirm the log page renders.
// Usage: node scripts/live-check.mjs <email> <password> [screenshotDir]
import { chromium } from 'playwright';

const [email, password, shotDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

await page.goto('https://marwoc-coder.github.io/the-field-report/');
await page.waitForSelector('input[type=email]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${shotDir}/live-1-login.png` });

await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button:has-text("Report In")');
await page.waitForSelector('text=Daily Activity', { timeout: 25000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shotDir}/live-2-log.png` });

console.log('LIVE CHECK PASSED');
await browser.close();
