import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function postToLinkedin({ content, imageBuffer, email, password }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  try {
    await loginMobile(page, email, password);
    await postDesktop(page, content, imageBuffer);
    console.log('[POST] ✓ Posted');
  } catch (err) {
    await page.screenshot({ path: join(__dirname, '..', 'data', 'linkedin-error.png'), fullPage: true });
    console.error('[POST] ✗ Failed — screenshot saved');
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function loginMobile(page, email, password) {
  console.log('[POST] Logging in (mobile)...');
  await page.goto('https://www.linkedin.com/m/login/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  await page.fill('input[name="session_key"], #username', email);
  await page.waitForTimeout(300);
  await page.fill('input[name="session_password"], #password', password);
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/feed/**', { timeout: 30000 });
  console.log('[POST] ✓ Logged in');
}

async function postDesktop(page, content, imageBuffer) {
  // Switch to desktop view for posting
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  if (imageBuffer) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles({ name: 'post-image.png', mimeType: 'image/png', buffer: imageBuffer });
      await page.waitForTimeout(4000);
    }
  }

  const editor = page.locator('[role="textbox"][aria-label*="Text"], div[contenteditable="true"]').first();
  if (await editor.isVisible().catch(() => false)) {
    await editor.fill(content);
    await page.waitForTimeout(1000);
  } else {
    const startPost = page.locator('[role="combobox"], div[data-placeholder*="What"]').first();
    if (await startPost.isVisible().catch(() => false)) {
      await startPost.click();
      await page.waitForTimeout(2000);
      if (await editor.isVisible().catch(() => false)) {
        await editor.fill(content);
        await page.waitForTimeout(1000);
      }
    }
  }

  const postBtn = page.locator('button[type="submit"]:not([disabled])').first();
  if (await postBtn.isVisible().catch(() => false)) {
    await postBtn.click();
    await page.waitForTimeout(5000);
  } else {
    // Fallback: post via mobile UI
    await page.goto('https://www.linkedin.com/m/feed/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const mobileEditor = page.locator('[contenteditable="true"], textarea').first();
    if (await mobileEditor.isVisible().catch(() => false)) {
      await mobileEditor.fill(content);
      await page.waitForTimeout(1000);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
  }
}
