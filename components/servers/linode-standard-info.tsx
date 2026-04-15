import type { ServerRecord } from "@/lib/api";

interface LinodeStandardInfoProps {
  server: ServerRecord;
}

function formatStorage(value: number) {
  return `${value} GB`;
}

export function LinodeStandardInfo({ server }: LinodeStandardInfoProps) {
  if (!server.providerSnapshot) {
    return null;
  }

  const snapshot = server.providerSnapshot;
  const ipv4Label = snapshot.publicIpv4.length > 0 ? snapshot.publicIpv4.join(", ") : "None";
  const ipv6Label = snapshot.publicIpv6.length > 0 ? snapshot.publicIpv6.join(", ") : "None";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Linode inventory</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Pulled from Linode plus the latest disk-usage probe.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {snapshot.summary}
          </div>
          {snapshot.tags.length > 0 ? (
            snapshot.tags.map((tag) => (
              <div
                className="rounded-full border border-border bg-white/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                key={tag}
              >
                {tag}
              </div>
            ))
          ) : (
            <div className="rounded-full border border-border bg-white/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              No tags
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            CPU Cores
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{snapshot.cpuCores}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            GB RAM
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{snapshot.ramGb}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Total Storage
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">
            {formatStorage(snapshot.totalStorageGb)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Used Storage
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">
            {typeof snapshot.usedStoragePercent === "number"
              ? `${snapshot.usedStoragePercent}% used`
              : "Unavailable"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Public IP v4
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{ipv4Label}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Public IP v6
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{ipv6Label}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Plan
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{snapshot.planLabel}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Region
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{snapshot.region}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span>
          Linode ID: <span className="text-foreground">{snapshot.linodeId}</span>
        </span>
        <span>
          Created: <span className="text-foreground">{new Date(snapshot.createdAt).toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
