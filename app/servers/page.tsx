import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { LinodeStandardInfo } from "@/components/servers/linode-standard-info";
import { getIncidents, getServers, type ServerRecord } from "@/lib/api";

type ProviderFilter = "all" | "akamai" | "digitalocean" | "unmatched";

const providerFilterOptions = [
  { label: "All", value: "all" },
  { label: "Akamai", value: "akamai" },
  { label: "DigitalOcean", value: "digitalocean" },
  { label: "Unmatched", value: "unmatched" },
] as const;

interface ServersPageProps {
  searchParams: Promise<{
    provider?: string | string[];
  }>;
}

function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /authentication is required|session was not valid/i.test(error.message)
  );
}

type ProviderKind = NonNullable<ServerRecord["providerMatch"]>["providerKind"];

function firstQueryValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function ProviderBadge({ kind }: { kind?: ProviderKind }) {
  if (kind === "digitalocean") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12">
            <path
              d="M12 2c-4.5 0-8 3.6-8 8 0 3.7 2.4 6.7 5.8 7.7V14c0-1.1.9-2 2-2h2.3c2.2 0 4-1.8 4-4 0-3.3-2.7-6-6.1-6Z"
              fill="currentColor"
            />
          </svg>
        </span>
        DigitalOcean
      </span>
    );
  }

  if (kind === "linode") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12">
            <path
              d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
              fill="currentColor"
              opacity="0.22"
            />
            <path d="M8 6.5h3.2v11H8v-11Zm4.8 0H16v11h-3.2v-11Z" fill="currentColor" />
          </svg>
        </span>
        Akamai
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12">
          <path
            d="M4 8.5 12 4l8 4.5V15l-8 5-8-5V8.5Zm8-1.8 4.8 2.7v4.3L12 16.6l-4.8-3V9.4L12 6.7Z"
            fill="currentColor"
          />
        </svg>
      </span>
      Unmatched
    </span>
  );
}

export default async function ServersPage({ searchParams }: ServersPageProps) {
  const cookieStore = await cookies();
  const resolvedSearchParams = await searchParams;

  try {
    const [serversPayload, incidentsPayload] = await Promise.all([
      getServers({
        cookie: cookieStore.toString(),
      }),
      getIncidents({
        cookie: cookieStore.toString(),
        limit: 100,
        offset: 0,
      }),
    ]);

    const incidentByServerId = new Map<string, typeof incidentsPayload.data.incidents>();
    for (const incident of incidentsPayload.data.incidents) {
      const existing = incidentByServerId.get(incident.serverId) ?? [];
      existing.push(incident);
      incidentByServerId.set(incident.serverId, existing);
    }

    const servers = serversPayload.data;
    const providerQueryValue = firstQueryValue(resolvedSearchParams.provider);
    const providerFilter: ProviderFilter =
      providerQueryValue === "akamai" ||
      providerQueryValue === "digitalocean" ||
      providerQueryValue === "unmatched"
        ? providerQueryValue
        : "all";
    const filteredServers = servers.filter((server) => {
      if (providerFilter === "all") {
        return true;
      }

      if (providerFilter === "unmatched") {
        return !server.providerMatch;
      }

      return server.providerMatch?.providerKind ===
        (providerFilter === "akamai" ? "linode" : "digitalocean");
    });
    const activeCount = filteredServers.filter(
      (server) => server.onboardingStatus === "active",
    ).length;
    const providerCounts = {
      akamai: servers.filter((server) => server.providerMatch?.providerKind === "linode").length,
      digitalocean: servers.filter(
        (server) => server.providerMatch?.providerKind === "digitalocean",
      ).length,
      unmatched: servers.filter((server) => !server.providerMatch).length,
    };

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Servers
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Server index
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse every server as a card. Open a server to inspect its health timeline, incidents, remediation runs, and activity history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {providerFilterOptions.map((option) => (
            <Link
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                providerFilter === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
              href={
                option.value === "all" ? "/servers" : `/servers?provider=${option.value}`
              }
              key={option.value}
            >
              {option.label}
              {option.value !== "all"
                ? ` (${providerCounts[option.value as Exclude<ProviderFilter, "all">]})`
                : ` (${servers.length})`}
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <Card className="space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Servers</div>
            <div className="text-2xl font-semibold text-foreground">{filteredServers.length}</div>
            <p className="text-sm text-muted-foreground">Total records in the current workspace.</p>
          </Card>
          <Card className="space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Active</div>
            <div className="text-2xl font-semibold text-foreground">{activeCount}</div>
            <p className="text-sm text-muted-foreground">Ready for checks, incidents, and remediation.</p>
          </Card>
          <Card className="space-y-2 md:col-span-2">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Timeline
            </div>
            <div className="text-2xl font-semibold text-foreground">{incidentsPayload.data.incidents.length}</div>
            <p className="text-sm text-muted-foreground">
              Recent incidents loaded for card summaries and timeline previews.
            </p>
          </Card>
        </div>

        <div className="grid gap-4">
          {filteredServers.length === 0 ? (
            <Card className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No servers match the current provider filter.
              </p>
            </Card>
          ) : (
            filteredServers.map((server) => {
              const serverIncidents = incidentByServerId.get(server.id) ?? [];
              const openCount = serverIncidents.filter((incident) => incident.status === "open").length;
              const remediationPendingCount = serverIncidents.filter(
                (incident) => incident.status === "remediation_pending",
              ).length;
              const latestIncident = serverIncidents[0];
              const lastActivityAt = latestIncident?.openedAt ?? server.updatedAt;

              return (
                <Link className="group block" href={`/servers/${server.id}`} key={server.id}>
                  <Card className="space-y-4 transition group-hover:border-primary/40 group-hover:bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ProviderBadge kind={server.providerMatch?.providerKind} />
                          <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {server.environment}
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {server.onboardingStatus}
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">{server.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {server.hostname}
                          {server.ipAddress ? ` • ${server.ipAddress}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition group-hover:border-primary/40 group-hover:text-foreground">
                        Open timeline
                      </span>
                    </div>

                    {server.providerSnapshot ? <LinodeStandardInfo server={server} /> : null}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/80 bg-white/80 p-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Open
                        </div>
                        <div className="mt-1 text-lg font-semibold text-foreground">{openCount}</div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-white/80 p-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Pending
                        </div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {remediationPendingCount}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-white/80 p-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Last activity
                        </div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                          {new Date(lastActivityAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {latestIncident ? latestIncident.title : "No incidents yet"}
                      </div>
                      <div>
                        {latestIncident
                          ? `Latest incident opened ${new Date(latestIncident.openedAt).toLocaleString()}`
                          : `Last updated ${new Date(server.updatedAt).toLocaleString()}`}
                      </div>
                      <div>{server.notes ?? "No server notes recorded."}</div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    );
  } catch (error) {
    if (isAuthError(error)) {
      redirect("/login");
    }

    throw error;
  }
}
