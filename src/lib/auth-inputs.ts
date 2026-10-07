const OTP_SELECTOR = 'input.cl-otpCodeFieldInput, .cl-otpCodeField input, input[autocomplete="one-time-code"], input[name="code"], input[id="code"], input[id^="otp"], input[aria-label*="verification code" i]';

export function enhanceAuthInputs(root: HTMLElement) {
  root.querySelectorAll<HTMLInputElement>(OTP_SELECTOR).forEach((input) => {
    if (input.type === "hidden") return;
    if (input.autocomplete !== "one-time-code") input.autocomplete = "one-time-code";
    if (input.inputMode !== "numeric") input.inputMode = "numeric";
  });
}
export function watchAuthInputs(root: HTMLElement) {
  enhanceAuthInputs(root);
  const observer = new MutationObserver(() => enhanceAuthInputs(root));
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "autocomplete", "inputmode"] });
  return () => observer.disconnect();
}
