import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getIncidents, getServers } from "@/lib/api";

function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /authentication is required|session was not valid/i.test(error.message)
  );
}

export default async function ServersPage() {
  const cookieStore = await cookies();

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
    const activeCount = servers.filter((server) => server.onboardingStatus === "active").length;

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

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <Card className="space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Servers</div>
            <div className="text-2xl font-semibold text-foreground">{servers.length}</div>
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

        <div className="grid gap-4 xl:grid-cols-2">
          {servers.length === 0 ? (
            <Card className="space-y-2 xl:col-span-2">
              <p className="text-sm text-muted-foreground">No servers recorded yet.</p>
            </Card>
          ) : (
            servers.map((server) => {
              const serverIncidents = incidentByServerId.get(server.id) ?? [];
              const openCount = serverIncidents.filter((incident) => incident.status === "open").length;
              const remediationPendingCount = serverIncidents.filter(
                (incident) => incident.status === "remediation_pending",
              ).length;
              const latestIncident = serverIncidents[0];

              return (
                <Link className="group block" href={`/servers/${server.id}`} key={server.id}>
                  <Card className="space-y-4 transition group-hover:border-primary/40 group-hover:bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          <span>{server.environment}</span>
                          <span>•</span>
                          <span>{server.onboardingStatus}</span>
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

                    <div className="grid gap-3 sm:grid-cols-3">
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
                          Latest
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                          {latestIncident ? latestIncident.title : "No incidents yet"}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {server.notes ?? "No server notes recorded."}
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
