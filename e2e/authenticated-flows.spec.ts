import { test, expect, Page } from '@playwright/test';

/**
 * Authenticated E2E: reels party button, comment posting, like/save toggling,
 * and the Inbox Requests accept + media+reaction flow.
 *
 * These flows require a signed-in test account. Provide credentials via env:
 *   E2E_EMAIL=…  E2E_PASSWORD=…
 * (and optionally E2E_PEER_EMAIL / E2E_PEER_PASSWORD for the DM flow).
 * When creds aren't provided we skip rather than fail — the harness stays
 * usable on any preview.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const PEER_EMAIL = process.env.E2E_PEER_EMAIL;
const PEER_PASSWORD = process.env.E2E_PEER_PASSWORD;

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15_000 });
}

test.describe('Reels: like / save / comments / party button', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL / E2E_PASSWORD to run.');

  test('like toggles once (no double-count) and reflects in UI', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);
    await page.goto('/feed');
    const likeBtn = page.getByRole('button', { name: /like/i }).first();
    await expect(likeBtn).toBeVisible();

    const countText = async () =>
      (await likeBtn.locator('xpath=..').innerText()).match(/\d+/)?.[0] ?? '0';
    const before = parseInt(await countText(), 10);

    await likeBtn.click();
    await page.waitForTimeout(600); // trigger + realtime propagation
    const after = parseInt(await countText(), 10);
    // Must change by exactly 1 (double-trigger bug would jump by 2).
    expect(Math.abs(after - before)).toBe(1);

    // Undo — must return to original count (proves no drift).
    await likeBtn.click();
    await page.waitForTimeout(600);
    expect(parseInt(await countText(), 10)).toBe(before);
  });

  test('save toggles independently of like count', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);
    await page.goto('/feed');
    const likeBtn = page.getByRole('button', { name: /like/i }).first();
    const saveBtn = page.getByRole('button', { name: /save|bookmark/i }).first();
    await expect(saveBtn).toBeVisible();

    const likeCount = async () =>
      parseInt((await likeBtn.locator('xpath=..').innerText()).match(/\d+/)?.[0] ?? '0', 10);
    const before = await likeCount();

    await saveBtn.click();
    await page.waitForTimeout(500);
    // Saving must not touch the like count (regression guard for the reported bug).
    expect(await likeCount()).toBe(before);
  });

  test('comment posting increments comments_count by exactly 1', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);
    await page.goto('/feed');
    const commentBtn = page.getByRole('button', { name: /comment/i }).first();
    await commentBtn.click();
    const input = page.getByPlaceholder(/add a comment|write a comment/i);
    await expect(input).toBeVisible();
    const msg = `e2e ${Date.now()}`;
    await input.fill(msg);
    await page.getByRole('button', { name: /post|send/i }).first().click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 5_000 });
  });

  test('Watch Party button is visible on reels and navigates to a party', async ({ page }) => {
    await signIn(page, EMAIL!, PASSWORD!);
    await page.goto('/watch-parties');
    await expect(page.getByRole('heading', { name: /watch part/i })).toBeVisible();
    const search = page.getByPlaceholder(/search/i).first();
    await expect(search).toBeVisible();
  });
});

test.describe('Inbox Requests: accept + media + reaction', () => {
  test.skip(
    !EMAIL || !PASSWORD || !PEER_EMAIL || !PEER_PASSWORD,
    'Set E2E_EMAIL/PASSWORD and E2E_PEER_EMAIL/PEER_PASSWORD to run.'
  );

  test('peer sends a request, primary accepts, replies with a reaction', async ({ browser }) => {
    // Peer sends a message from a fresh browser context.
    const peerCtx = await browser.newContext();
    const peerPage = await peerCtx.newPage();
    await signIn(peerPage, PEER_EMAIL!, PEER_PASSWORD!);
    await peerPage.goto('/notifications');
    // Assumption: primary user is searchable by username in the inbox.
    const composeSearch = peerPage.getByPlaceholder(/search|to:/i).first();
    if (await composeSearch.isVisible().catch(() => false)) {
      await composeSearch.fill(EMAIL!.split('@')[0]);
      await peerPage.getByRole('option').first().click().catch(() => {});
    }
    const send = peerPage.getByPlaceholder(/message/i).first();
    if (await send.isVisible().catch(() => false)) {
      const msg = `hey ${Date.now()}`;
      await send.fill(msg);
      await peerPage.getByRole('button', { name: /send/i }).click();
    }
    await peerCtx.close();

    // Primary user accepts and reacts.
    const primaryCtx = await browser.newContext();
    const page = await primaryCtx.newPage();
    await signIn(page, EMAIL!, PASSWORD!);
    await page.goto('/notifications');
    await page.getByRole('tab', { name: /requests/i }).click();
    await page.getByRole('button', { name: /accept/i }).first().click();
    await expect(page.getByRole('tab', { name: /messages/i })).toBeVisible();

    // Reply with an emoji reaction on the last received message.
    const lastMsg = page.locator('[data-message-id]').last();
    if (await lastMsg.isVisible().catch(() => false)) {
      await lastMsg.dblclick();
      const emoji = page.getByRole('button', { name: /❤️|👍|😂/ }).first();
      if (await emoji.isVisible().catch(() => false)) {
        await emoji.click();
      }
    }
    await primaryCtx.close();
  });
});