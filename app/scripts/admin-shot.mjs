// One-off: screenshot the admin panel. Usage: node scripts/admin-shot.mjs <email> <pw> <dir>
import { chromium } from 'playwright';
const [email, password, shotDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto('http://localhost:4173/');
await page.waitForSelector('input[type=email]');
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button:has-text("Report In")');
await page.waitForSelector('text=Daily Activity', { timeout: 20000 });
await page.click('.navbar a[href="#/admin"]');
await page.waitForSelector('text=COMMAND POST', { timeout: 15000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${shotDir}/shot-5-admin.png` });
await browser.close();
console.log('ADMIN SHOT DONE');
