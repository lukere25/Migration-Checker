import { Page } from "@playwright/test";

// ─── Selectors tried in order ────────────────────────────────────────────────
// Higher-priority, vendor-specific selectors come first so they win over
// broad text-match selectors that could accidentally click the wrong button.

const overlayDismissSelectors = [
  // ── Consent / cookie platforms ──────────────────────────────────────────
  "#onetrust-accept-btn-handler",           // OneTrust
  "#onetrust-close-btn-handler",
  ".osano-cm-accept-all",                   // Osano
  ".osano-cm-dialog__close",
  "#CybotCookiebotDialogBodyButtonAccept",  // Cookiebot
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  ".cc-btn.cc-allow",                       // Cookie Consent (insites)
  ".cc-dismiss",
  "#accept-cookie-consent",
  "#cookie-accept",
  "#cookie_action_close_header",
  'button[id*="cookie"][id*="accept" i]',
  'button[id*="gdpr"][id*="accept" i]',
  '[class*="cookie-banner" i] button[class*="accept" i]',
  '[class*="cookie-banner" i] button[class*="close" i]',
  '[class*="cookie-consent" i] button[class*="accept" i]',
  '[class*="cookie-consent" i] button[class*="close" i]',
  '[class*="gdpr" i] button[class*="accept" i]',
  '[class*="gdpr" i] button[class*="close" i]',
  '[id*="cookie-bar" i] button',
  '[id*="cookie-notice" i] button',

  // ── Chat / support widgets ───────────────────────────────────────────────
  '#launcher',                              // Zendesk
  'button[data-testid="close-button"]',     // Zendesk / generic
  '.intercom-launcher-frame',               // Intercom
  '[id*="intercom"] button[class*="close"]',
  '[class*="drift" i] button[class*="close" i]',  // Drift
  '[id*="drift"] button',
  '[class*="hubspot-messages" i] button[class*="close" i]', // HubSpot
  '[aria-label="Close chat"]',
  '[aria-label="Minimize chat"]',
  '[title*="Close chat" i]',

  // ── Promo / newsletter / exit-intent modals ──────────────────────────────
  '[class*="modal" i] button[class*="close" i]',
  '[class*="modal" i] [aria-label*="close" i]',
  '[class*="popup" i] button[class*="close" i]',
  '[class*="popup" i] [aria-label*="close" i]',
  '[class*="overlay" i] button[class*="close" i]',
  '[role="dialog"] button[class*="close" i]',
  '[role="dialog"] [aria-label*="close" i]',
  '[role="alertdialog"] button[class*="close" i]',
  '[role="alertdialog"] [aria-label*="close" i]',

  // ── Sticky notification / alert bars ────────────────────────────────────
  '[class*="notification-bar" i] button',
  '[class*="alert-bar" i] button',
  '[class*="announcement" i] button[class*="close" i]',
  '[class*="banner" i] button[class*="close" i]',
  '[class*="toast" i] button[class*="close" i]',
  '[role="alert"] button[class*="close" i]',
  '[role="status"] button[class*="close" i]',

  // ── Generic text-match (lower priority) ─────────────────────────────────
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Accept Cookies")',
  'button:has-text("Allow all cookies")',
  'button:has-text("Allow All")',
  'button:has-text("Allow all")',
  'button:has-text("Allow cookies")',
  'button:has-text("Accept")',
  'button:has-text("Agree")',
  'button:has-text("I Agree")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  'button:has-text("Got It")',
  'button:has-text("OK")',
  'button:has-text("Okay")',
  'button:has-text("No thanks")',
  'button:has-text("Not now")',
  'button:has-text("Dismiss")',
  'button:has-text("Close")',
  'button:has-text("Continue")',
  'button:has-text("Understood")',
  'button:has-text("That\'s fine")',

  // ── Aria-label catch-alls ────────────────────────────────────────────────
  '[aria-label*="accept" i]',
  '[aria-label*="close" i]',
  '[aria-label*="dismiss" i]',
  '[aria-label*="decline" i]',

  // ── Class/ID name patterns ───────────────────────────────────────────────
  'button.close',
  'a.close',
  '[class*="close-button" i]',
  '[class*="closeButton" i]',
  '[class*="btn-close" i]',
  '[id*="cookie" i] button',
  '[class*="cookie" i] button',
];

/**
 * Dismiss cookie banners, chat widgets, promo modals, alerts, and tooltips
 * before a page screenshot is captured.
 *
 * Strategy:
 *  1. Wait briefly after page load so JS-rendered overlays have time to appear.
 *  2. Handle any browser-level dialog (alert/confirm/prompt) by dismissing it.
 *  3. Try Escape first — closes most modal/dialog overlays without side-effects.
 *  4. Walk the selector list and click any visible dismiss button (up to 4 passes).
 *  5. Hide any remaining fixed/sticky overlay elements via CSS injection.
 */
export async function closePageOverlays(page: Page): Promise<void> {
  // 1. Short wait for JS-rendered overlays to mount
  await page.waitForTimeout(600).catch(() => undefined);

  // 2. Auto-dismiss any native browser dialog (alert / confirm / prompt)
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => undefined));

  // 3. Press Escape to close any open modal/tooltip
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(200).catch(() => undefined);

  // 4. Click dismiss buttons — up to 4 passes in case new overlays appear
  for (let pass = 0; pass < 4; pass++) {
    let dismissed = false;

    for (const selector of overlayDismissSelectors) {
      try {
        const button = page.locator(selector).first();
        if (!(await button.isVisible({ timeout: 300 }).catch(() => false))) continue;
        await button.click({ timeout: 1500, force: false }).catch(() => undefined);
        await page.waitForTimeout(300).catch(() => undefined);
        dismissed = true;
      } catch {
        // Ignore per-selector errors and continue
      }
    }

    if (!dismissed) break;

    // Press Escape again between passes to catch secondary dialogs
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(150).catch(() => undefined);
  }

  // 5. Force-hide any remaining fixed/sticky overlay layers via CSS injection
  //    (covers overlays whose dismiss buttons couldn't be clicked)
  await page.addStyleTag({
    content: `
      [id*="cookie" i]:not(script):not(style),
      [class*="cookie-banner" i],
      [class*="cookie-consent" i],
      [class*="cookie-notice" i],
      [class*="gdpr" i]:not(script):not(style),
      [class*="consent-banner" i],
      [class*="chat-widget" i],
      [class*="chat-launcher" i],
      [id*="launcher" i]:not(script):not(style),
      [class*="intercom" i][class*="frame" i],
      [class*="drift-widget" i],
      [class*="hubspot-messages" i],
      [class*="promo-banner" i],
      [class*="announcement-bar" i],
      [class*="exit-intent" i],
      [class*="email-capture" i],
      [role="alertdialog"]:not([data-keep]),
      #onetrust-banner-sdk,
      #CybotCookiebotDialog {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  }).catch(() => undefined);

  // Final short wait for layout to settle after overlay removal
  await page.waitForTimeout(300).catch(() => undefined);
}

export function shouldCloseOverlaysBeforeCompare(): boolean {
  return process.env.CLOSE_OVERLAYS_BEFORE_COMPARE !== "false";
}
