import { Card } from "@/components/ui/card";

export default function IncidentsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Incidents
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Incident queue
        </h1>
      </div>

      <Card className="space-y-2">
        <p className="text-sm text-muted-foreground">
          This placeholder route is ready for deterministic check failures, remediation attempts, and audit-linked incident history.
        </p>
      </Card>
    </div>
  );
}
