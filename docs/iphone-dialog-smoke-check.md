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

### Replit / Nix setup

The native dependencies are declared in `.replit` against `stable-25_05`.
After those packages are available, run:

```sh
npm ci
npm run browser:setup
# Start the app with Run and wait until it is ready, then separately:
npm run test:browser:all
```

`browser:setup` downloads the WebKit revision from the locked Playwright package
and verifies that it can launch, create a page, and interact with an input.
It also runs automatically in `scripts/post-merge.sh`. Browser downloads are
cached, not committed. A missing browser or library is a hard failure.

On Nix, `scripts/webkit-runtime.mjs` resolves the declared library outputs from
the configured Nix channel, including ICU 74 and JPEG 8; it does not search for
arbitrary versions in `/nix/store`. The project-owned WebKit launcher preserves
those library paths alongside the downloaded browser's bundled libraries.
It checks actual dependency resolution with `ldd` and selects Mesa's software
EGL renderer explicitly. This avoids relying on a system `ldconfig` cache,
which does not represent all Nix libraries. On macOS and ordinary Linux runners
without `NIX_PATH`, Playwright's normal launcher is unchanged.

The download command may print a warning about `libgles2` or
`gstreamer1.0-libav` because its default Linux detector checks that system cache.
The subsequent **WebKit readiness check**, not the download alone, establishes
whether setup succeeded. Do not set `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`,
replace WebKit with Chromium, or skip failing tests.

To isolate a browser:

```sh
npm run test:browser:webkit
npm run test:browser
```

The Replit Chromium executable is used only for the Chromium project. The
`mobile-browser` validation runs both projects and is intentionally **not** part
of the default Run group. Start the app first, then run validation separately.
When no app is running, Playwright may start and own its development server;
do not press Run concurrently. In CI, Playwright starts its own server and
requires port 5000 to be free.

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

The automated short-portrait checks reduce only the visual viewport to simulate
keyboard obstruction, preserving the layout viewport and entered values.
This does not claim that desktop WebKit opens or emulates a native iOS keyboard.

### Result record

Automated regression on Replit, 2026-10-07: **12/12 passed** with
`npm run test:browser:all` — six Chromium cases and six iPhone-emulated WebKit
26.6 cases. Both projects passed the 390 × 844 and 1024 × 900 field/layout and
nested-dialog checks, plus the 390 × 640 short-portrait keyboard viewport and
scrolled-parent nested Close/Escape checks. Focus restoration, clipping bounds,
retained field values, footer pointer reachability, and backdrop cleanup were
checked. No tests were skipped.

No real-iPhone pass is claimed; device results remain separate below.

| Device / iOS | Date | Environment | Portrait | Landscape / bars | Focus / close | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Not yet run | — | — | — | — | — | Fill in after a real-device check |
