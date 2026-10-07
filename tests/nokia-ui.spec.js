const { test, expect } = require('@playwright/test');
const path = require('path');

const appUrl = `file://${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;

test('screen keeps a 3:4 Nokia QVGA aspect ratio', async ({ page }) => {
  await page.goto(appUrl);
  const ratio = await page.locator('.screen').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return Number((rect.width / rect.height).toFixed(2));
  });

  expect(ratio).toBeCloseTo(0.75, 1);
});

test('keypad input builds a real dial string in order', async ({ page }) => {
  await page.goto(appUrl);

  for (const key of '0874467132***') {
    await page.locator(`[data-key="${key}"]`).click();
  }

  await expect(page.locator('[data-testid="dial-number"]')).toHaveText('0874467132***');
});

test('call history, menu, and camera app are reachable from phone controls', async ({ page }) => {
  await page.goto(appUrl);

  await page.getByRole('button', { name: 'call', exact: true }).click();
  let activeTitle = page.locator('.screen-view.active [data-testid="screen-title"]');
  await expect(activeTitle).toHaveText(/Call History/);

  await page.locator('[data-key="0"]').click();
  await page.getByRole('button', { name: 'call', exact: true }).click();
  await expect(activeTitle).toHaveText(/Calling/);
  await expect(page.locator('[data-testid="call-number"]')).toHaveText('0');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('nokia.callHistory') || '[]')[0]?.number)).toBe('0');

  await page.locator('[data-testid="nav-ok"]').click();
  await expect(activeTitle).toHaveText(/Menu/);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }]
        })
      }
    });
  });
  await page.reload();
  await page.evaluate(() => window.openAppForTest('camera'));
  await expect(activeTitle).toHaveText(/Camera/);
});

test('d-pad selection opens gallery and gallery can set the wallpaper', async ({ page }) => {
  await page.goto(appUrl);

  await page.locator('[data-testid="nav-ok"]').click();
  await page.locator('[data-testid="nav-right"]').click();
  await page.locator('[data-testid="nav-ok"]').click();

  const activeTitle = page.locator('.screen-view.active [data-testid="screen-title"]');
  await expect(activeTitle).toHaveText(/Gallery/);
  await page.getByRole('button', { name: /set wallpaper/i }).click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('nokia.wallpaper'))).toContain('9yb1x8i34faf1.jpg');
});

test('right side hardware is volume control instead of camera', async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.locator('[data-testid="camera-button"]')).toHaveCount(0);
  await page.locator('[data-testid="volume-up"]').click();
  await expect(page.locator('[data-testid="volume-level"]')).toHaveText('6');
  await page.locator('[data-testid="volume-down"]').click();
  await expect(page.locator('[data-testid="volume-level"]')).toHaveText('5');
});

test('computer keyboard behaves like the physical phone keypad', async ({ page }) => {
  await page.goto(appUrl);

  await page.keyboard.type('0874467132***');
  await expect(page.locator('[data-testid="dial-number"]')).toHaveText('0874467132***');

  await page.keyboard.press('Enter');
  const activeTitle = page.locator('.screen-view.active [data-testid="screen-title"]');
  await expect(activeTitle).toHaveText(/Calling/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#home-view')).toHaveClass(/active/);

  await page.keyboard.press('m');
  await expect(activeTitle).toHaveText(/Menu/);
});
