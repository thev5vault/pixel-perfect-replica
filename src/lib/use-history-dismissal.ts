import { useCallback, useEffect, useId, useRef } from "react";

const HISTORY_MODAL_KEY = "__v5vaultModalId";

function modalIdFromState(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return undefined;
  const modalId = (state as Record<string, unknown>)[HISTORY_MODAL_KEY];
  return typeof modalId === "string" ? modalId : undefined;
}

export function useHistoryDismissal(
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const modalId = useId();
  const historyEntryAdded = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const dismiss = useCallback(() => {
    onOpenChangeRef.current(false);
  }, []);

  useEffect(() => {
    if (open && !historyEntryAdded.current) {
      const state = window.history.state;
      const currentState =
        state && typeof state === "object" ? (state as Record<string, unknown>) : {};
      window.history.pushState(
        { ...currentState, [HISTORY_MODAL_KEY]: modalId },
        "",
        window.location.href,
      );
      historyEntryAdded.current = true;
      return;
    }

    if (!open && historyEntryAdded.current) {
      historyEntryAdded.current = false;
      if (modalIdFromState(window.history.state) === modalId) {
        window.history.back();
      }
    }
  }, [modalId, open]);

  useEffect(() => {
    const handlePopState = () => {
      if (
        historyEntryAdded.current &&
        modalIdFromState(window.history.state) !== modalId
      ) {
        historyEntryAdded.current = false;
        dismiss();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dismiss, modalId]);
}
