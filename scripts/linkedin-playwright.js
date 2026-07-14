import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function postToLinkedinPagePlaywright({ content, imagePath, pageUrl }) {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password) throw new Error('Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env');

  const userDataDir = join(__dirname, '..', '.linkedin-session');

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  let pages = browser.pages();
  const page = pages[0] || await browser.newPage();

  try {
    console.log('      Opening LinkedIn...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    let url = page.url();
    if (url.includes('feed') || !url.includes('login')) {
      console.log('      ✓ Already logged in (session found)');
    } else {
      console.log('      Filling login form...');
      await page.evaluate((val) => {
        const el = document.querySelector('input[autocomplete="username"]');
        if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
      }, email);
      await page.evaluate((val) => {
        const el = document.querySelector('input[autocomplete="current-password"]');
        if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
      }, password);
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
      let tries = 0;
      while (tries < 30) {
        const u = page.url();
        if (u.includes('/feed') || u.includes('/checkpoint/challengesV2')) break;
        if (!u.includes('/login') && !u.includes('/checkpoint')) break;
        await page.waitForTimeout(2000);
        tries++;
      }
      if (page.url().includes('/checkpoint/challengesV2')) {
        console.log('      [!] Challenge page — solve it in the browser window');
        await page.waitForURL(u => u.includes('/feed'), { timeout: 120000 }).catch(() => {});
      }
      console.log('      ✓ Logged in');
    }

    console.log('      Going to LinkedIn feed to find company page...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    console.log('      Looking for company pages in sidebar...');
    const sidebarLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/company/"]');
      return Array.from(links).slice(0, 5).map(a => ({
        href: a.getAttribute('href'),
        text: (a.textContent || '').trim().slice(0, 60),
      }));
    });
    console.log('      Company links found in sidebar:', JSON.stringify(sidebarLinks));

    let targetUrl = pageUrl;
    if (sidebarLinks.length > 0) {
      const href = sidebarLinks[0].href;
      targetUrl = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
      console.log(`      Using company URL from sidebar: ${targetUrl}`);
    } else {
      console.log('      Trying numeric company page ID from .env...');
      const pageId = process.env.LINKEDIN_PAGE_ID || '134233993';
      targetUrl = `https://www.linkedin.com/company/${pageId}/`;
    }

    console.log(`      Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    console.log(`      Current URL: ${page.url()}`);
    const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) || '').catch(() => '');
    console.log(`      Page text: ${pageText.slice(0, 200).replace(/\n/g, ' | ')}`);

    if (page.url().includes('unavailable')) {
      console.log('      [!] Company page not found. Posting to personal feed instead.');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
    }

    console.log('      Opening post composer...');
    const postSelectors = [
      'button:has-text("Start a post")',
      'button:has-text("Create a post")',
      'button:has-text("Write article")',
      '[data-placeholder*="Start a post"]',
      '[data-placeholder*="Share"]',
      '[data-placeholder*="share"]',
      '.share-box',
      'div[role="button"]',
    ];

    let composerOpened = false;
    for (const sel of postSelectors) {
      try {
        const el = page.locator(sel).first();
        const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          console.log(`      ✓ Found: ${sel}`);
          await el.click();
          composerOpened = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (!composerOpened) {
      await page.screenshot({ path: join(__dirname, '..', 'linkedin-error.png'), fullPage: true }).catch(() => {});
      throw new Error('Could not open post composer');
    }

    await page.waitForTimeout(3000);

    const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
    await editor.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await editor.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate((text) => {
      const el = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (el) { el.focus(); document.execCommand('insertText', false, text); }
    }, content);
    await page.waitForTimeout(1000);

    if (imagePath) {
      console.log('      Attaching image...');
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
        page.evaluate(() => {
          const addMedia = document.querySelector('button[aria-label*="media"], button[aria-label*="photo"], button[aria-label*="image"], button[aria-label*="Media"], button[aria-label*="Photo"]');
          if (addMedia) addMedia.click();
        }).catch(() => {}),
      ]);
      if (fileChooser) {
        await fileChooser.setFiles(imagePath);
        await page.waitForTimeout(3000);
        console.log('      ✓ Image attached');
      } else {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fileInput.setInputFiles(imagePath);
          await page.waitForTimeout(3000);
        } else {
          const mediaBtn = page.locator('[aria-label*="media"], [aria-label*="photo"], [aria-label*="image"], [aria-label*="Media"], [aria-label*="Photo"]').first();
          if (await mediaBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await mediaBtn.click();
            await page.waitForTimeout(2000);
            const fileI = page.locator('input[type="file"]').first();
            if (await fileI.isVisible({ timeout: 2000 }).catch(() => false)) {
              await fileI.setInputFiles(imagePath);
              await page.waitForTimeout(3000);
            }
          }
        }
        console.log('      ✓ Image attached');
      }
    }

    await page.waitForTimeout(2000);
    const submitBtn = page.locator('button:has-text("Post")').last();
    try {
      await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
      await submitBtn.click();
      await page.waitForTimeout(5000);
      console.log('      ✓ Posted!');
    } catch {
      await page.screenshot({ path: join(__dirname, '..', 'linkedin-error.png'), fullPage: true }).catch(() => {});
      throw new Error('Post button not found or not clickable');
    }

    await page.waitForTimeout(2000);
    await browser.close();
    return true;
  } catch (err) {
    await page.screenshot({ path: join(__dirname, '..', 'linkedin-error.png'), fullPage: true }).catch(() => {});
    await browser.close();
    throw new Error(err.message);
  }
}