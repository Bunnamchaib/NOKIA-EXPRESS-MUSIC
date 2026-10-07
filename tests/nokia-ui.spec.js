const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const appUrl = `file://${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;

test('screen keeps a 3:4 Nokia QVGA aspect ratio', async ({ page }) => {
  await page.goto(appUrl);
  const ratio = await page.locator('.screen').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return Number((rect.width / rect.height).toFixed(2));
  });

  expect(ratio).toBeCloseTo(0.75, 1);
});

test('pwa metadata uses express music with install icons and locked viewport', async ({ page }) => {
  await page.goto(appUrl);

  await expect(page).toHaveTitle('express music');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'assets/apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'express music');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /user-scalable=no/);
});

test('phone fits inside an iPhone viewport without document scrolling', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  await page.goto(appUrl);

  const metrics = await page.evaluate(() => {
    const phone = document.querySelector('.phone').getBoundingClientRect();
    return {
      phoneTop: phone.top,
      phoneBottom: phone.bottom,
      phoneLeft: phone.left,
      phoneRight: phone.right,
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflow: getComputedStyle(document.body).overflow
    };
  });

  expect(metrics.phoneTop).toBeGreaterThanOrEqual(-1);
  expect(metrics.phoneLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.phoneRight).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.phoneBottom).toBeLessThanOrEqual(metrics.height + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.height);
  expect(metrics.overflow).toBe('hidden');
  await context.close();
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
  await page.getByLabel('set selected as wallpaper').click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('nokia.wallpaper'))).toContain('9yb1x8i34faf1.jpg');
});

test('right side hardware has volume keys with a real svg camera button between them', async ({ page }) => {
  await page.goto(appUrl);

  const rightSideOrder = await page.locator('.volume-stack [data-testid]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
  expect(rightSideOrder).toEqual(['volume-up', 'camera-button', 'volume-down']);
  await expect(page.locator('[data-testid="camera-button"] svg')).toHaveCount(1);

  await page.locator('[data-testid="volume-up"]').click();
  await expect(page.locator('[data-testid="volume-level"]')).toHaveText('6');
  await page.locator('[data-testid="camera-button"]').click();
  await expect(page.locator('.screen-view.active [data-testid="screen-title"]')).toHaveText(/Camera/);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="volume-down"]').click();
  await expect(page.locator('[data-testid="volume-level"]')).toHaveText('5');
});

test('settings exposes configurable hardware button controls', async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => window.openAppForTest('settings'));

  await expect(page.locator('[data-testid="button-settings"]')).toContainText('Hardware buttons');
  await expect(page.locator('[data-testid="button-settings"]')).toContainText('single');
  await expect(page.locator('[data-testid="button-settings"]')).toContainText('double');
  await expect(page.locator('[data-testid="button-settings"]')).toContainText('hold');
});

test('left music controls are compact and stay inside the red rail frame', async ({ page }) => {
  await page.goto(appUrl);

  const railBox = await page.locator('.side-rail.left').boundingBox();
  const rail = { left: railBox.x, right: railBox.x + railBox.width };
  const buttons = await page.locator('.music-stack .side-key').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  }));

  await expect(page.locator('.music-stack .side-key svg')).toHaveCount(3);
  await expect(page.locator('.music-stack .side-key').first()).toHaveCSS('color', 'rgb(255, 255, 255)');

  for (const button of buttons) {
    expect(button.width).toBeLessThanOrEqual(26);
    expect(button.left).toBeGreaterThanOrEqual(rail.left - 1);
    expect(button.right).toBeLessThanOrEqual(rail.right + 1);
  }
});

test('soft keys support back one step, exit all, and recent apps hold gesture without visible labels', async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.locator('[data-testid="left-top-name"]')).toBeHidden();
  await expect(page.locator('[data-testid="right-top-name"]')).toBeHidden();
  await expect(page.locator('[data-testid="left-bottom-name"]')).toBeHidden();
  await expect(page.locator('[data-testid="right-bottom-name"]')).toBeHidden();

  await page.locator('[data-testid="nav-ok"]').click();
  await page.locator('[data-testid="nav-right"]').click();
  await page.locator('[data-testid="nav-ok"]').click();
  const activeTitle = page.locator('.screen-view.active [data-testid="screen-title"]');
  await expect(activeTitle).toHaveText(/Gallery/);

  await page.locator('[data-testid="right-soft"]').click();
  await expect(activeTitle).toHaveText(/Menu/);

  await page.evaluate(() => window.openAppForTest('music'));
  await page.evaluate(() => window.openAppForTest('settings'));
  await page.locator('[data-testid="right-soft"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(700);
  await page.locator('[data-testid="right-soft"]').dispatchEvent('pointerup');
  await expect(activeTitle).toHaveText(/Recent Apps/);
  await expect(page.locator('[data-testid="recent-list"]')).toContainText('Music');
  await expect(page.locator('[data-testid="recent-list"]')).toContainText('Settings');

  await page.locator('[data-testid="nav-up"]').click();
  await expect(page.locator('[data-testid="recent-list"]')).not.toContainText('Settings');
  await page.locator('[data-testid="nav-down"]').click();
  await expect(page.locator('[data-testid="recent-list"]')).toContainText('No recent apps');

  await page.evaluate(() => window.openAppForTest('gallery'));
  await page.locator('[data-testid="right-bottom"]').click();
  await expect(page.locator('#home-view')).toHaveClass(/active/);
});

test('status bar uses phone-style icons for 5G signal, wifi, and battery', async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.locator('[data-testid="network-5g"]')).toHaveText('5G');
  await expect(page.locator('[data-testid="signal-icon"] i')).toHaveCount(5);
  await expect(page.locator('[data-testid="wifi-icon"] .wifi-arc')).toHaveCount(3);
  await expect(page.locator('[data-testid="battery-icon"] .battery-fill')).toHaveCount(1);
});

test('music opens empty with an import control and bottom player', async ({ page }) => {
  await page.goto(appUrl);

  await page.evaluate(() => window.openAppForTest('music'));
  await expect(page.locator('[data-testid="music-empty"]')).toContainText('No music');
  await expect(page.locator('[data-testid="music-player-title"]')).toHaveText('No music');
  await expect(page.locator('[data-testid="music-folder-input"]')).toBeAttached();

  const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nokia-music-'));
  fs.writeFileSync(path.join(musicDir, 'demo-song.mp3'), Buffer.from([0, 1, 2, 3]));
  await page.locator('[data-testid="music-folder-input"]').setInputFiles(musicDir);
  await expect(page.locator('[data-testid="music-library"]')).toContainText('demo-song');
  await page.getByRole('button', { name: /demo-song/ }).click();
  await page.locator('[data-testid="right-bottom"]').click();

  await expect(page.locator('[data-testid="now-playing"]')).toContainText('demo-song');
});

test('calculator uses phone keypad digits and d-pad operators without leaving the app', async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => window.openAppForTest('calculator'));

  await page.locator('[data-key="1"]').click();
  await page.locator('[data-key="2"]').click();
  await page.locator('[data-testid="nav-left"]').click();
  await expect(page.locator('.screen-view.active [data-testid="screen-title"]')).toHaveText(/Calculator/);
  await page.locator('[data-key="7"]').click();
  await page.locator('[data-testid="nav-ok"]').click();

  await expect(page.locator('[data-testid="calculator-display"]')).toHaveText('19');

  await page.locator('[data-testid="nav-right"]').click();
  await expect(page.locator('.screen-view.active [data-testid="screen-title"]')).toHaveText(/Calculator/);
  await page.locator('[data-key="3"]').click();
  await page.locator('[data-testid="nav-ok"]').click();
  await expect(page.locator('[data-testid="calculator-display"]')).toHaveText('57');
});

test('camera center key captures a named photo into Nokia gallery and exposes share actions', async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => window.openAppForTest('camera'));

  await page.locator('[data-testid="left-soft"]').click();
  await page.getByLabel('photo name').fill('shop-front');
  await page.locator('[data-testid="capture-delay"]').selectOption('0');
  await page.getByRole('button', { name: /back to camera/i }).click();
  await page.locator('[data-testid="nav-ok"]').click();

  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('nokia.galleryImages') || '[]')[0]?.name)).toBe('shop-front');
  await page.evaluate(() => window.openAppForTest('gallery'));
  await expect(page.getByRole('button', { name: 'shop-front' })).toBeVisible();
  await expect(page.locator('[data-testid="share-photo"]')).toBeVisible();
  await expect(page.locator('[data-testid="download-photo"]')).toBeVisible();
});

test('camera left soft key opens camera settings', async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => window.openAppForTest('camera'));

  await page.locator('[data-testid="left-soft"]').click();
  await expect(page.locator('.screen-view.active [data-testid="screen-title"]')).toHaveText(/Camera Settings/);
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
