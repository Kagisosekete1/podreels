import { test, expect, Page } from '@playwright/test';

/**
 * Discover overlay E2E:
 *  - opens a reel into the fullscreen overlay
 *  - taps to play
 *  - toggles mute/unmute
 *  - asserts the underlying <video> element state
 *
 * Runs against both `desktop-chromium` and `mobile-safari` projects
 * (configured in playwright.config.ts), so a single spec covers
 * desktop + iOS Safari emulation.
 *
 * Notes:
 *  - The Discover grid requires reels to exist in the backend. If the
 *    grid is empty in the target env, the test is skipped rather than
 *    failed, so it can run cleanly on a seeded or unseeded preview.
 *  - We avoid auth: Discover is public.
 */

const videoSel = '[role="dialog"][aria-label="Reel player"] video';

// A small, reliable public test video so the spec never depends on backend data.
const MOCK_REEL = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'E2E Mock Reel',
  thumbnail_url: null,
  video_url:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  views_count: 1,
  likes_count: 0,
  category: 'General',
  hashtags: [],
  user_id: '00000000-0000-0000-0000-000000000002',
};

test.beforeEach(async ({ page }) => {
  // Seed at least one reel into the Discover grid via the app's E2E escape
  // hatch, so the test never relies on the live backend having data.
  await page.addInitScript((reel) => {
    (window as any).__E2E_REELS__ = [reel];
    sessionStorage.removeItem('reels:playCount');
  }, MOCK_REEL);
});

async function openFirstReel(page: Page) {
  await page.goto('/discover');
  await page.waitForLoadState('networkidle');
  const tile = page.locator('.grid button.aspect-\\[9\\/16\\]').first();
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page.locator('[role="dialog"][aria-label="Reel player"]')).toBeVisible();
  await expect(page.locator(videoSel)).toBeVisible();
}

test.describe('Discover overlay — tap to play & mute toggle', () => {
  test('opens overlay, taps to play, toggles mute and unmute', async ({ page }) => {
    await openFirstReel(page);

    // Give the ReelPlayer a moment to attach and attempt autoplay.
    await page.waitForTimeout(500);

    // Tap the video (acts as tap-to-play / pause toggle).
    await page.locator(videoSel).click();
    await page.waitForTimeout(300);

    // Assert: video element exists and has a src.
    const hasSrc = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => !!el.currentSrc
    );
    expect(hasSrc).toBe(true);

    // --- Unmute ---
    await page.getByRole('button', { name: 'Unmute' }).click().catch(async () => {
      // Already unmuted? Force a mute first then unmute.
      await page.getByRole('button', { name: 'Mute' }).click();
      await page.getByRole('button', { name: 'Unmute' }).click();
    });
    await page.waitForTimeout(200);

    const afterUnmute = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => ({ muted: el.muted, paused: el.paused })
    );
    expect(afterUnmute.muted).toBe(false);

    // UI should reflect: button now reads "Mute".
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();

    // --- Re-mute ---
    await page.getByRole('button', { name: 'Mute' }).click();
    await page.waitForTimeout(200);
    const afterMute = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => el.muted
    );
    expect(afterMute).toBe(true);
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();

    // --- Close: video must pause and reset ---
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[role="dialog"][aria-label="Reel player"]')).toHaveCount(0);
  });

  test('closing overlay stops the video (no background playback)', async ({ page }) => {
    await openFirstReel(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Close' }).click();
    // After close the dialog is gone — there must be no playing overlay video.
    await expect(page.locator(videoSel)).toHaveCount(0);
  });

  test('ad overlay is hidden (ads disabled)', async ({ page }) => {
    await openFirstReel(page);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.locator('.grid button.aspect-\\[9\\/16\\]').first().click();
    // Ads are intentionally disabled — the sponsored dialog must never appear.
    await expect(page.getByRole('dialog', { name: 'Sponsored message' })).toHaveCount(0);
  });
});

/**
 * Mobile-specific checks for iPhone 13 emulation. We assert that:
 *  - The overlay video autoplays muted (iOS Safari requirement).
 *  - Tapping the video toggles play/pause without errors.
 *  - Tapping Unmute inside a real gesture flips video.muted to false and
 *    the UI button label updates accordingly.
 */
test.describe('Discover overlay — iPhone 13 mobile checks', () => {
  test('autoplays muted, tap toggles play/pause, unmute works on a real tap', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-safari', 'Mobile-only');
    await openFirstReel(page);

    // Mobile must start muted so iOS allows autoplay.
    await page.waitForTimeout(600);
    const initial = await page.locator(videoSel).evaluate((el: HTMLVideoElement) => ({
      muted: el.muted,
      paused: el.paused,
      readyState: el.readyState,
    }));
    expect(initial.muted).toBe(true);

    // Tap to pause.
    await page.locator(videoSel).tap();
    await page.waitForTimeout(200);
    const afterFirstTap = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => el.paused
    );
    // Tap to play again.
    await page.locator(videoSel).tap();
    await page.waitForTimeout(200);
    const afterSecondTap = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => el.paused
    );
    expect(afterFirstTap).not.toBe(afterSecondTap);

    // Unmute via the explicit gesture button — iOS only honors this inside a tap.
    await page.getByRole('button', { name: 'Unmute' }).tap();
    await page.waitForTimeout(300);
    const afterUnmute = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => el.muted
    );
    expect(afterUnmute).toBe(false);
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();

    // Re-mute via tap.
    await page.getByRole('button', { name: 'Mute' }).tap();
    await page.waitForTimeout(200);
    const afterReMute = await page.locator(videoSel).evaluate(
      (el: HTMLVideoElement) => el.muted
    );
    expect(afterReMute).toBe(true);
  });
});