import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  const cookieStore = await cookies();

  try {
    const payload = await getIncidents({
      cookie: cookieStore.toString(),
      limit: 25,
      offset: 0,
    });

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Incidents
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Incident queue
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Open incidents, remediation-pending cases, and resolved source records all live in one queue.
          </p>
        </div>

        <div className="grid gap-4">
          {payload.data.incidents.length === 0 ? (
            <Card className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No incidents recorded yet.
              </p>
            </Card>
          ) : (
            payload.data.incidents.map((incident) => (
              <Card className="space-y-3" key={incident.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {incident.severity} • {incident.status}
                    </p>
                    <h2 className="text-lg font-semibold text-foreground">{incident.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {incident.summary ?? "No summary"}
                    </p>
                  </div>
                  <Link
                    className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    href={`/incidents/${incident.id}`}
                  >
                    Open detail
                  </Link>
                </div>
                <div className="text-xs text-muted-foreground">
                  Opened {new Date(incident.openedAt).toLocaleString()}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    throw error;
  }
}
