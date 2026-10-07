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

test('call, menu, and camera modes are reachable from hardware controls', async ({ page }) => {
  await page.goto(appUrl);

  await page.locator('[data-key="0"]').click();
  await page.getByRole('button', { name: 'call', exact: true }).click();
  const activeTitle = page.locator('.screen-view.active [data-testid="screen-title"]');

  await expect(activeTitle).toHaveText(/Calling/);
  await expect(page.locator('[data-testid="call-number"]')).toHaveText('0');

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
  await page.locator('[data-testid="camera-button"]').click();
  await expect(activeTitle).toHaveText(/Camera/);
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
