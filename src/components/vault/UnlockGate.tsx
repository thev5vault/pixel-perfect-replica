import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, LockKeyhole, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatVrm, useVault } from "@/lib/vault-store";
import { ShieldLogo } from "./ui-bits";

export function UnlockGate() {
  const { unlock } = useVault();
  const [vrm, setVrm] = useState("");
  const [date, setDate] = useState<Date>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!vrm.trim() || !date) return setError("Enter your registration and V5C issue date.");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    const ok = unlock(vrm, format(date, "yyyy-MM-dd"));
    setBusy(false);
    if (!ok) setError("Those details don't match a vehicle record. Check your V5C logbook.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-5" style={{ backgroundImage: "var(--gradient-vault)" }}>
      <form onSubmit={submit} className="w-full max-w-sm animate-vault-open space-y-6">
        <div className="text-center">
          <ShieldLogo className="mx-auto h-16 w-16 animate-shield" />
          <h1 className="mt-4 text-3xl font-bold">V5Vault</h1>
          <p className="text-sm text-muted-foreground">UK Digital Vehicle Passport</p>
        </div>

        <div className="vault-card space-y-5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole className="h-4 w-4 text-primary" /> V5C Logbook Verification
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration Mark</span>
            <div className="uk-plate w-full text-2xl">
              <span className="flex items-center bg-primary/80 px-2 font-sans text-xs font-bold text-primary-foreground">UK</span>
              <input
                value={vrm}
                onChange={(e) => setVrm(formatVrm(e.target.value).slice(0, 8))}
                placeholder="AB14 CDE"
                aria-label="Registration mark"
                autoCapitalize="characters"
                className="w-full bg-transparent px-3 py-2 text-center uppercase outline-none placeholder:text-plate-foreground/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">V5C Logbook Issue Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={cn("field flex items-center gap-2 text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4" />
                  {date ? format(date, "d MMMM yyyy") : "Pick the date on your V5C"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  captionLayout="dropdown"
                  defaultMonth={date ?? new Date(2019, 2)}
                  startMonth={new Date(1990, 0)}
                  endMonth={new Date()}
                  disabled={{ after: new Date() }}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {busy ? "Verifying ownership…" : "Unlock Vault"}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Demo vehicle: <span className="font-semibold text-foreground">AB14 CDE</span> · V5C issued <span className="font-semibold text-foreground">15 Mar 2019</span>
        </p>
      </form>
    </div>
  );
}
