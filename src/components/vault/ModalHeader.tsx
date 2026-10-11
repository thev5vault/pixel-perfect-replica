import type { ReactNode } from "react";
import { X } from "lucide-react";
import { DialogClose, DialogHeader } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ModalHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-20 flex flex-none items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3", className)}>
      <DialogHeader className="min-w-0 text-left">{children}</DialogHeader>
      <DialogClose className="flex h-12 w-12 min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-1 text-slate-400 outline-none transition-colors hover:text-white focus:outline-none focus:ring-0" aria-label="Close">
        <X className="h-5 w-5" />
      </DialogClose>
    </header>
  );
}
