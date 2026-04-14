import { Activity, AlertTriangle, ServerCog, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getDashboardSnapshot } from "@/lib/api";

const snapshot = getDashboardSnapshot();

export function DashboardShell() {
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
            <span className="text-sm text-muted-foreground">3 unresolved</span>
          </div>
          <div className="space-y-3">
            {[
              "Disk usage above 85% on wp-prod-1",
              "PHP-FPM restart executed on blog-edge-02",
              "SSH onboarding awaiting provider confirmation",
            ].map((item) => (
              <div
                className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-foreground"
                key={item}
              >
                {item}
              </div>
            ))}
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
