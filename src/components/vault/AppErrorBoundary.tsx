import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, { componentStack: info.componentStack });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-bold">This view couldn’t be displayed</h1>
          <p className="text-sm text-slate-400">Your saved vehicle records are still in this browser. Reload to restore the app.</p>
          <button className="btn-primary w-full" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </div>
    );
  }
}
