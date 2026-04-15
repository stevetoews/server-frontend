import type { ReactNode } from "react";

import type { ServerRecord } from "@/lib/api";

interface LinodeStandardInfoProps {
  server: ServerRecord;
}

function formatStorage(value: number) {
  return `${value} GB`;
}

function DetailField({
  label,
  children,
  small = false,
}: {
  children: ReactNode;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/80 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className={small ? "mt-2 text-xs text-foreground" : "mt-2 text-sm text-foreground"}>
        {children}
      </div>
    </div>
  );
}

export function LinodeStandardInfo({ server }: LinodeStandardInfoProps) {
  if (!server.providerSnapshot) {
    return null;
  }

  const snapshot = server.providerSnapshot;
  const ipv4Label = snapshot.publicIpv4.length > 0 ? snapshot.publicIpv4.join(", ") : "None";
  const ipv6Label = snapshot.publicIpv6.length > 0 ? snapshot.publicIpv6.join(", ") : "None";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Linode standard information</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pulled from Linode plus the latest disk-usage probe.
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {snapshot.summary}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailField label="Summary">{snapshot.summary}</DetailField>
        <DetailField label="CPU Cores">{snapshot.cpuCores}</DetailField>
        <DetailField label="GB RAM">{snapshot.ramGb}</DetailField>
        <DetailField label="Total Storage">{formatStorage(snapshot.totalStorageGb)}</DetailField>
        <DetailField label="Used Storage">
          {typeof snapshot.usedStoragePercent === "number"
            ? `${snapshot.usedStoragePercent}% used`
            : "Unavailable"}
        </DetailField>
        <DetailField label="Public IP v4">{ipv4Label}</DetailField>
        <DetailField label="Public IP v6">{ipv6Label}</DetailField>
        <DetailField label="Plan">{snapshot.planLabel}</DetailField>
        <DetailField label="Region">{snapshot.region}</DetailField>
        <DetailField label="Tags" small>
          {snapshot.tags.length > 0 ? snapshot.tags.join(", ") : "None"}
        </DetailField>
        <DetailField label="Linode ID" small>
          {snapshot.linodeId}
        </DetailField>
        <DetailField label="Created" small>
          {new Date(snapshot.createdAt).toLocaleString()}
        </DetailField>
      </div>
    </div>
  );
}
