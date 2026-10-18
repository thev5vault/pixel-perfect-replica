import { MotStatusPill } from "@/components/vault/MotStatusPill";

type Props = {
  certificateId: string;
  documentTitle: string;
  vehicleMakeModel: string;
  issuedDate: string;
  source?: "official" | "demo" | "user-provided" | undefined;
  motHistorySource?: "official" | "demo" | "user-provided" | undefined;
  motStatus?: string | undefined;
  motExpiry?: string | undefined;
};

export function PassportCertificate({
  certificateId,
  documentTitle,
  vehicleMakeModel,
  issuedDate,
  source,
  motHistorySource,
  motStatus,
  motExpiry,
}: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Certificate {certificateId}
        </p>
        <h2 className="mt-0.5 break-words text-lg font-bold text-slate-900">{documentTitle}</h2>
        <p className="break-words text-xs text-slate-700">{vehicleMakeModel}</p>
        <p className="mt-1 text-xs text-slate-500">Issued {issuedDate}</p>
      </div>
      <MotStatusPill
        source={source}
        motHistorySource={motHistorySource}
        motStatus={motStatus}
        motExpiry={motExpiry}
        className="shrink-0"
      />
    </div>
  );
}
