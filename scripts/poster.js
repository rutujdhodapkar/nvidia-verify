import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function postToLinkedin({ content, imageBuffer, email, password }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await login(page, email, password);

    if (imageBuffer) {
      await postWithImage(page, content, imageBuffer);
    } else {
      await postTextOnly(page, content);
    }

    console.log('[POST] ✓ Posted successfully');
  } catch (err) {
    await page.screenshot({ path: join(__dirname, '..', 'data', 'linkedin-error.png') });
    console.error('[POST] ✗ Failed — screenshot saved to data/linkedin-error.png');
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

const LOGIN_SELECTORS = {
  email: ['#username', 'input[name="session_key"]', '#session_key', 'input[type="text"]'],
  password: ['#password', 'input[name="session_password"]', 'input[type="password"]'],
  submit: ['button[type="submit"]', 'button[class*="sign-in"]', '.sign-in-form__submit-btn'],
};

async function login(page, email, password) {
  console.log('[POST] Logging in...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('script')?.remove()); // basic evasion

  for (const sel of LOGIN_SELECTORS.email) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.fill(email);
      console.log(`[POST] Filled email using: ${sel}`);
      break;
    }
  }

  for (const sel of LOGIN_SELECTORS.password) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.fill(password);
      break;
    }
  }

  for (const sel of LOGIN_SELECTORS.submit) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      console.log(`[POST] Clicked submit: ${sel}`);
      break;
    }
  }

  await page.waitForURL('**/feed/**', { timeout: 30000 });
  console.log('[POST] ✓ Logged in');
}

async function postTextOnly(page, content) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  const startPost = page.locator('[role="combobox"], [data-placeholder*="What"], .share-box__open, div[role="button"]:has-text("Start a post")').first();
  await startPost.waitFor({ state: 'visible', timeout: 15000 });
  await startPost.click();
  await page.waitForTimeout(2000);

  const editor = page.locator('[role="textbox"][aria-label*="Text"], div[contenteditable="true"][data-placeholder*="What"]').first();
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  await editor.fill(content);
  await page.waitForTimeout(1000);

  const postBtn = page.locator('button[type="submit"]:not([disabled])').first();
  await postBtn.waitFor({ state: 'visible', timeout: 10000 });
  await postBtn.click();
  await page.waitForTimeout(4000);
}

async function postWithImage(page, content, imageBuffer) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  const startPost = page.locator('[role="combobox"], [data-placeholder*="What"], .share-box__open, div[role="button"]:has-text("Start a post")').first();
  await startPost.waitFor({ state: 'visible', timeout: 15000 });
  await startPost.click();
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles({ name: 'post-image.png', mimeType: 'image/png', buffer: imageBuffer });
    await page.waitForTimeout(4000);
  }

  const editor = page.locator('[role="textbox"][aria-label*="Text"], div[contenteditable="true"][data-placeholder*="What"]').first();
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  await editor.fill(content);
  await page.waitForTimeout(1500);

  const postBtn = page.locator('button[type="submit"]:not([disabled])').first();
  await postBtn.waitFor({ state: 'visible', timeout: 10000 });
  await postBtn.click();
  await page.waitForTimeout(4000);
}
