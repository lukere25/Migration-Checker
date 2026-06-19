import { Page } from "@playwright/test";

const overlayDismissSelectors = [
  "#onetrust-accept-btn-handler",
  ".osano-cm-accept-all",
  '[data-testid*="accept" i]',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Accept")',
  'button:has-text("Allow all")',
  'button:has-text("Agree")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("Close")',
  'button:has-text("No thanks")',
  'button:has-text("Not now")',
  'button:has-text("Dismiss")',
  '[aria-label*="accept" i]',
  '[aria-label*="close" i]',
  '[aria-label*="dismiss" i]',
  'button.close',
  '[class*="close-button" i]',
  '[class*="cookie" i] button',
  '[id*="cookie" i] button',
  '[role="dialog"] button[class*="close" i]',
  '[role="dialog"] [aria-label*="close" i]'
];

/** Dismiss cookie banners, promo modals, and tooltip overlays before capture. */
export async function closePageOverlays(page: Page): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    let dismissed = false;

    for (const selector of overlayDismissSelectors) {
      const button = page.locator(selector).first();
      if (!(await button.isVisible({ timeout: 400 }).catch(() => false))) continue;

      await button.click({ timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(350).catch(() => undefined);
      dismissed = true;
    }

    if (!dismissed) break;
  }
}

export function shouldCloseOverlaysBeforeCompare(): boolean {
  return process.env.CLOSE_OVERLAYS_BEFORE_COMPARE !== "false";
}
