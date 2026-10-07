# Vehicle dialogs: Safari / iPhone checks

## Automated browser regression

`npm run test:browser:all` runs the same dialog regression in **Chromium** and
**iPhone-emulated WebKit**, each at 390 × 844 and 1024 × 900. The wider WebKit
case deliberately retains touch/mobile behavior to cover a wider mobile viewport;
it is not a desktop Safari profile.

On a supported macOS or Ubuntu runner, install the browsers first:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run test:browser:all
```

To isolate a browser:

```sh
npm run test:browser:webkit
npm run test:browser
```

The Replit Chromium executable is used only for the Chromium project. WebKit
needs Playwright's own browser and native libraries; a successful download alone
does not establish that it can launch on NixOS. Do not silently substitute
Chromium or silently skip WebKit when its dependencies are missing. The existing
Replit `mobile-browser` workflow runs Chromium; use the explicit WebKit/all commands
on a supported runner or perform the real-device check below and record the result.

The regression checks the visual viewport, input focus rings and minimum mobile
font size, child/backdrop stacking, Close and Escape dismissal, and focus
restoration to the upgrade trigger. It does not submit keeper claims or start
checkout.

## Real-iPhone smoke check

Use a development preview in Safari on an actual iPhone, not the in-app preview
iframe. Record device model, iOS version, date, URL/environment, orientation,
and pass/fail for each step. Use only development samples and do not enter real
V5C references. This checklist is a procedure, not evidence of a completed
device run.

1. Enter **Direct GodMode Bypass**, open the sample vehicle, and choose
   **Basic Driver (Free)** from the profile menu.
2. Choose **Connect New Vehicle** from the vehicle menu. Check that the heading,
   Close button, and footer stay within the visible screen. Tap registration,
   V5C reference, then VIN; their focus rings should be visible, not clipped, and
   Safari should not zoom into the input. Scroll the dialog to reach all fields.
   Dismiss the keyboard and close the dialog. Confirm its backdrop is gone and
   the underlying page responds to taps.
3. Open **Add a basic DIY service entry**, then **Parts vs labour cost**.
   Confirm the Pro DIY upgrade appears above the receipt and its darker backdrop
   covers the parent. Close only the upgrade; the receipt must remain open with
   its entered values intact. Reopen and close the upgrade again, then close the
   receipt. There must be no leftover backdrop or blocked page.
4. Repeat steps 2–3 in landscape and with Safari's browser bars expanded and
   collapsed. Check the upgrade and connection dialogs fit the visible viewport
   and Close remains reachable. Scroll long content rather than the page behind
   the dialog.
5. If a hardware keyboard is available, Tab through each dialog. The focus ring
   must remain visible; focus must not leave the active dialog. Escape in the
   upgrade must close only that child and return focus to its trigger. A second
   Escape should close the parent.

Keyboard-obscured service-form behavior is tracked separately; this check does
not claim that desktop WebKit emulates the iOS on-screen keyboard.

### Result record

In the task environment, Playwright WebKit downloaded but could not launch because
native libraries were missing. No automated Safari pass or real-iPhone pass is
claimed. Chromium results should be recorded separately from device results.

Chromium regression: 390 × 844 and 1024 × 900 passed on 2026-10-07, including
viewport bounds, visible focus, nested stacking, focus restoration, Close and
Escape. The final Chromium run passed all four browser cases, and the final
unit run passed all 77 tests.

| Device / iOS | Date | Environment | Portrait | Landscape / bars | Focus / close | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Not yet run | — | — | — | — | — | Fill in after a real-device check |
