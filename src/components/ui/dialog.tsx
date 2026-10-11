"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useHistoryDismissal } from "@/lib/use-history-dismissal";

function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  useHistoryDismissal(open, handleOpenChange);

  return (
    <DialogPrimitive.Root
      {...props}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
}

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const [viewport, setViewport] = React.useState<{ height: number; top: number } | null>(null);
  React.useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    const update = () => {
      // Mobile keyboards can resize only the visual viewport, leaving dvh and
      // the layout viewport unchanged. Keep the sheet above the keyboard.
      setViewport(
        visualViewport.scale === 1
          ? { height: visualViewport.height, top: visualViewport.offsetTop }
          : null,
      );
    };
    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
    };
  }, []);
  return (
  <DialogPrimitive.Overlay
    ref={ref}
    style={{
      ...(viewport
        ? {
            top: viewport.top,
            height: viewport.height,
            bottom: "auto",
            "--dialog-max-height": `${viewport.height * 0.9}px`,
          }
        : {}),
      ...style,
    } as React.CSSProperties}
    className={cn(
      "fixed inset-0 z-50 flex items-end justify-center bg-black/70 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md overscroll-none sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; nested?: boolean }
>(({ className, children, showCloseButton = true, nested = false, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  return (
  <DialogPortal>
    <DialogOverlay className={nested ? "z-[60]" : undefined}>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        `relative ${nested ? "z-[60]" : "z-50"} flex min-h-0 max-h-[var(--dialog-max-height,85vh)] w-full max-w-lg flex-col gap-0 overflow-y-auto custom-scrollbar rounded-t-3xl border border-slate-800 bg-slate-900 p-0 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl`,
        className,
      )}
      onOpenAutoFocus={(event) => {
        if (nested) {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        // Controlled nested dialogs may have no Radix Trigger to restore.
        // Return keyboard focus to their opener without scrolling the parent.
        if (nested && !event.defaultPrevented && returnFocusRef.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus({ preventScroll: true });
        }
      }}
      {...props}
    >
      {children}
      {showCloseButton && <DialogPrimitive.Close className="absolute right-4 top-4 z-30 flex h-12 w-12 min-h-12 min-w-12 items-center justify-center border-none bg-transparent p-1 text-slate-400 opacity-100 outline-none cursor-pointer transition-colors hover:text-white focus:border-none focus:outline-none focus:ring-0 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>}
    </DialogPrimitive.Content>
    </DialogOverlay>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
