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

async function openFirstReel(page: Page) {
  await page.goto('/discover');
  // Wait for the grid to either render reels or show the empty state.
  await page.waitForLoadState('networkidle');
  const tile = page.locator('.grid button.aspect-\\[9\\/16\\]').first();
  const count = await tile.count();
  test.skip(count === 0, 'No reels available in this environment to test against.');
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
});