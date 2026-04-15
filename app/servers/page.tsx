import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { LinodeStandardInfo } from "@/components/servers/linode-standard-info";
import { getIncidents, getServers, type ServerRecord } from "@/lib/api";
import { getServerHealthSummary, getToneClasses } from "@/lib/server-health";

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
      <div className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Servers
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Server index
          </h1>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Compact fleet view. Open a card for the full timeline, incidents, remediations, and activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {providerFilterOptions.map((option) => (
            <Link
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
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

        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <Card className="space-y-1 p-2.5">
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Servers
            </div>
            <div className="text-lg font-semibold text-foreground">{filteredServers.length}</div>
          </Card>
          <Card className="space-y-1 p-2.5">
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Active
            </div>
            <div className="text-lg font-semibold text-foreground">{activeCount}</div>
          </Card>
          <Card className="space-y-1 p-2.5 md:col-span-2">
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Timeline
            </div>
            <div className="text-lg font-semibold text-foreground">
              {incidentsPayload.data.incidents.length}
            </div>
          </Card>
        </div>

        <div className="grid gap-2.5">
          {filteredServers.length === 0 ? (
            <Card className="space-y-2 p-3.5">
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
              const serverHealth = getServerHealthSummary(server, serverIncidents);

              return (
                <Link className="group block" href={`/servers/${server.id}`} key={server.id}>
                  <Card className="space-y-2.5 p-3.5 md:p-4 transition group-hover:border-primary/40 group-hover:bg-white">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ProviderBadge kind={server.providerMatch?.providerKind} />
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getToneClasses(serverHealth.tone)}`}
                          >
                            {serverHealth.label}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                            {server.environment}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                            {server.onboardingStatus}
                          </span>
                        </div>
                        <h2 className="text-base font-semibold text-foreground">{server.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {server.hostname}
                          {server.ipAddress ? ` • ${server.ipAddress}` : ""}
                        </p>
                      </div>
                    </div>

                    {server.providerSnapshot ? <LinodeStandardInfo server={server} /> : null}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Open {openCount}</span>
                      <span>Pending {remediationPendingCount}</span>
                      <span>Updated {new Date(lastActivityAt).toLocaleString()}</span>
                    </div>

                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {latestIncident ? latestIncident.title : "No incidents yet"}
                      </div>
                      <div>
                        {latestIncident
                          ? `Latest incident opened ${new Date(latestIncident.openedAt).toLocaleString()}`
                          : `Last updated ${new Date(server.updatedAt).toLocaleString()}`}
                      </div>
                      {server.notes ? <div>{server.notes}</div> : null}
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
