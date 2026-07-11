import { chromium } from 'playwright';

export async function postToLinkedin({ content, imageBuffer, email, password }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await login(page, email, password);

    if (imageBuffer) {
      await postWithImage(page, content, imageBuffer);
    } else {
      await postTextOnly(page, content);
    }

    console.log('[POST] ✓ Posted to LinkedIn');
  } finally {
    await context.close();
    await browser.close();
  }
}

async function login(page, email, password) {
  console.log('[POST] Logging in...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForSelector('#username', { timeout: 15000 });
  await page.fill('#username', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/feed/**', { timeout: 30000 });
  console.log('[POST] ✓ Logged in');
}

async function postTextOnly(page, content) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  const startPost = page.locator('[data-placeholder*="What do you want"], .share-box__open, [role="combobox"]').first();
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

  const startPost = page.locator('[data-placeholder*="What do you want"], .share-box__open, [role="combobox"]').first();
  await startPost.waitFor({ state: 'visible', timeout: 15000 });
  await startPost.click();
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  if (await fileInput.isVisible()) {
    await fileInput.setInputFiles({ name: 'post-image.png', mimeType: 'image/png', buffer: imageBuffer });
    await page.waitForTimeout(3000);
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
