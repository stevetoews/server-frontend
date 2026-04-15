import { Activity, AlertTriangle, ServerCog, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getDashboardSnapshot, type IncidentRecord } from "@/lib/api";

const snapshot = getDashboardSnapshot();

interface DashboardShellProps {
  incidents: IncidentRecord[];
}

export function DashboardShell({ incidents }: DashboardShellProps) {
  const stats = [
    {
      label: "Active Servers",
      value: snapshot.activeServers,
      icon: ServerCog,
    },
    {
      label: "Open Incidents",
      value: snapshot.incidentsOpen,
      icon: AlertTriangle,
    },
    {
      label: "Passing Checks",
      value: `${snapshot.checksPassing}%`,
      icon: ShieldCheck,
    },
    {
      label: "Provider Coverage",
      value: snapshot.providerCoverage,
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
              {incidents.filter((incident) => incident.status !== "resolved").length} unresolved
            </span>
          </div>
          <div className="space-y-3">
            {incidents.length > 0 ? (
              incidents.slice(0, 3).map((incident) => (
                <Link
                  className="block rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-foreground transition hover:border-primary/40 hover:bg-white"
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
              <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-foreground">
                No incidents recorded yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">System posture</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>SSH and WP-CLI actions stay inside explicit allowlists.</li>
            <li>Linode or DigitalOcean matching is required before activation.</li>
            <li>SpinupWP mapping unlocks only after primary provider confirmation.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
