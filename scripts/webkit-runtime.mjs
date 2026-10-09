import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function webkitLaunchOptions() {
  if (process.platform !== "linux" || !process.env.NIX_PATH) return {};

  // Resolve the declared packages, never whichever versions happen to be in
  // /nix/store. getLib also handles split library outputs (e.g. x264).
  const config = readFileSync(resolve(root, ".replit"), "utf8");
  const match = config.match(/\[nix\][\s\S]*?packages\s*=\s*(\[[\s\S]*?\])/);
  if (!match) throw new Error("WebKit requires the native packages declared in .replit");
  const packages = JSON.parse(match[1]);
  if (!packages.every((name) => /^[a-zA-Z0-9_.-]+$/.test(name))) {
    throw new Error("Invalid Nix package attribute in .replit");
  }
  const expression = `
    let p = import <nixpkgs> {}; in {
      libraries = p.lib.makeLibraryPath (with p; [ ${packages.join(" ")} ]);
      plugins = p.lib.makeSearchPath "lib/gstreamer-1.0" (with p; [
        gst_all_1.gst-plugins-base gst_all_1.gst-plugins-bad gst_all_1.gst-libav
      ]);
      gioModules = p.lib.makeSearchPath "lib/gio/modules" (with p; [ glib-networking ]);
      eglVendor = "\${p.mesa}/share/glvnd/egl_vendor.d/50_mesa.json";
      dri = "\${p.mesa}/lib/dri";
    }
  `;
  const runtime = JSON.parse(
    execFileSync("nix-instantiate", ["--eval", "--strict", "--json", "-E", expression], {
      encoding: "utf8",
      timeout: 60_000,
    }),
  );

  return {
    executablePath: resolve(root, "scripts/launch-webkit.sh"),
    env: {
      ...process.env,
      PW_WEBKIT_BROWSER_DIR: dirname(webkit.executablePath()),
      LD_LIBRARY_PATH: [runtime.libraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
      GST_PLUGIN_SYSTEM_PATH_1_0: runtime.plugins,
      GIO_EXTRA_MODULES: [runtime.gioModules, process.env.GIO_EXTRA_MODULES]
        .filter(Boolean)
        .join(":"),
      __EGL_VENDOR_LIBRARY_FILENAMES: runtime.eglVendor,
      LIBGL_DRIVERS_PATH: runtime.dri,
      LIBGL_ALWAYS_SOFTWARE: "1",
    },
  };
}
