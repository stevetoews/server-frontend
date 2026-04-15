import { Activity, AlertTriangle, ServerCog, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { IncidentRecord, ServerRecord } from "@/lib/api";

interface DashboardShellProps {
  incidents: IncidentRecord[];
  servers: ServerRecord[];
}

export function DashboardShell({ incidents, servers }: DashboardShellProps) {
  const unresolvedIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const activeServers = servers.filter((server) => server.onboardingStatus === "active");
  const providerCoverage = {
    akamai: servers.filter((server) => server.providerMatch?.providerKind === "linode").length,
    digitalocean: servers.filter((server) => server.providerMatch?.providerKind === "digitalocean")
      .length,
  };
  const impactedServerIds = new Set(unresolvedIncidents.map((incident) => incident.serverId));
  const healthyServerCount = activeServers.filter((server) => !impactedServerIds.has(server.id)).length;
  const stats = [
    {
      label: "Active Servers",
      value: activeServers.length,
      icon: ServerCog,
    },
    {
      label: "Open Incidents",
      value: unresolvedIncidents.length,
      icon: AlertTriangle,
    },
    {
      label: "Healthy Servers",
      value: healthyServerCount,
      icon: ShieldCheck,
    },
    {
      label: "Provider Coverage",
      value: `Akamai ${providerCoverage.akamai} / DO ${providerCoverage.digitalocean}`,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Overview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Deterministic monitoring first
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The dashboard is structured around health checks, incidents, audit logs, and provider-aware remediation rather than free-form AI actions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card className="space-y-3" key={stat.label}>
            <stat.icon className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent incidents</h2>
            <span className="text-sm text-muted-foreground">
              {unresolvedIncidents.length} unresolved
            </span>
          </div>
          <div className="space-y-3">
            {incidents.length > 0 ? (
              incidents.slice(0, 3).map((incident) => (
                <Link
                  className="block rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-sm text-foreground transition hover:border-primary/40 hover:bg-accent/55"
                  href={`/incidents/${incident.id}`}
                  key={incident.id}
                >
                  <div className="font-medium">{incident.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {incident.severity} • {incident.status}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-sm text-foreground">
                No incidents recorded yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">System posture</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>SSH and WordOps actions stay inside explicit allowlists.</li>
            <li>Provider metadata from Akamai or DigitalOcean stays read-only context.</li>
            <li>Servers activate immediately after live SSH verification and host discovery.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
