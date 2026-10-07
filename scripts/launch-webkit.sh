#!/usr/bin/env bash
set -euo pipefail

: "${PW_WEBKIT_BROWSER_DIR:?Use npm run browser:setup or the Playwright config}"
bundle="minibrowser-gtk"
for arg in "$@"; do
  if [[ "$arg" == "--headless" ]]; then bundle="minibrowser-wpe"; fi
done
bundle="${PW_WEBKIT_BROWSER_DIR}/${bundle}"
if [[ ! -x "${bundle}/bin/MiniBrowser" ]]; then
  echo "WebKit is missing. Run npm run browser:setup." >&2
  exit 1
fi

# The upstream bundle launcher overwrites LD_LIBRARY_PATH. Preserve the
# declared Nix libraries while retaining the bundle's own library precedence.
export LD_LIBRARY_PATH="${bundle}/lib:${bundle}/sys/lib:${LD_LIBRARY_PATH:-}"
export WEBKIT_EXEC_PATH="${bundle}/bin"
export WEBKIT_INJECTED_BUNDLE_PATH="${bundle}/lib"
export WEBKIT_INSPECTOR_RESOURCES_PATH="${bundle}/share"
export WEBKIT_FORCE_COMPLEX_TEXT=1

# Playwright's default Linux check assumes an ldconfig cache. Check the real
# library resolution instead; missing dependencies remain a hard failure.
for binary in "${bundle}"/bin/* "${bundle}"/lib/*.so*; do
  [[ -f "$binary" ]] || continue
  dependencies="$(ldd "$binary" 2>&1)" || {
    echo "Cannot inspect WebKit dependencies: ${binary}" >&2
    echo "$dependencies" >&2
    exit 1
  }
  if [[ "$dependencies" == *"not found"* ]]; then
    echo "Missing WebKit native dependencies: ${binary}" >&2
    echo "$dependencies" >&2
    exit 1
  fi
done
exec "${bundle}/bin/MiniBrowser" "$@"
