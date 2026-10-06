import type { ReactNode } from "react";
import { X } from "lucide-react";
import { DialogClose, DialogHeader } from "@/components/ui/dialog";

export function ModalHeader({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex flex-none items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
      <DialogHeader className="min-w-0 text-left">{children}</DialogHeader>
      <DialogClose className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400" aria-label="Close">
        <X className="h-5 w-5" />
      </DialogClose>
    </header>
  );
}
