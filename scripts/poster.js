import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function postToLinkedin({ content, imageBuffer, email, password }) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  try {
    await login(page, email, password);
    let posted = false;
    if (imageBuffer) posted = await postWithImage(page, content, imageBuffer);
    if (!posted) await postTextOnly(page, content);
    console.log('[POST] ✓ Posted successfully');
  } catch (err) {
    await page.screenshot({ path: join(__dirname, '..', 'data', 'linkedin-error.png'), fullPage: true });
    console.error('[POST] ✗ Failed — screenshot saved');
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function login(page, email, password) {
  console.log('[POST] Logging in...');

  await page.goto('https://www.linkedin.com/checkpoint/lg/login', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  const emailField = page.locator('#session_key, input[name="session_key"], #username');
  await emailField.waitFor({ state: 'visible', timeout: 15000 });
  await emailField.fill(email);
  await page.waitForTimeout(500);

  const passField = page.locator('#session_password, input[name="session_password"], #password');
  await passField.fill(password);
  await page.waitForTimeout(500);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  await page.waitForURL('**/feed/**', { timeout: 30000 });
  console.log('[POST] ✓ Logged in');
}

async function postTextOnly(page, content) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const startPost = page.locator('[role="combobox"], div[data-placeholder*="What"]').first();
  await startPost.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
  await startPost.click();
  await page.waitForTimeout(2000);

  const editor = page.locator('[role="textbox"][aria-label*="Text"], div[contenteditable="true"]').first();
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  await editor.fill(content);
  await page.waitForTimeout(1000);

  const postBtn = page.locator('button[type="submit"]:not([disabled])').first();
  await postBtn.waitFor({ state: 'visible', timeout: 10000 });
  await postBtn.click();
  await page.waitForTimeout(5000);
}

async function postWithImage(page, content, imageBuffer) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const startPost = page.locator('[role="combobox"], div[data-placeholder*="What"]').first();
  if (!(await startPost.isVisible().catch(() => false))) return false;
  await startPost.click();
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles({ name: 'post-image.png', mimeType: 'image/png', buffer: imageBuffer });
    await page.waitForTimeout(4000);
  }

  const editor = page.locator('[role="textbox"][aria-label*="Text"], div[contenteditable="true"]').first();
  if (!(await editor.isVisible().catch(() => false))) return false;
  await editor.fill(content);
  await page.waitForTimeout(1500);

  const postBtn = page.locator('button[type="submit"]:not([disabled])').first();
  await postBtn.waitFor({ state: 'visible', timeout: 10000 });
  await postBtn.click();
  await page.waitForTimeout(5000);
  return true;
}
