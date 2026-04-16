import type { HealthCheckRecord, IncidentRecord, ServerRecord } from "./api";

export type HealthTone = "danger" | "good" | "neutral" | "warn";

export function getToneClasses(tone: HealthTone) {
  if (tone === "good") {
    return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
  }

  if (tone === "warn") {
    return "border-amber-500/30 bg-amber-500/12 text-amber-200";
  }

  if (tone === "danger") {
    return "border-rose-500/30 bg-rose-500/12 text-rose-200";
  }

  return "border-border bg-card text-muted-foreground";
}

export function getCheckTone(status: HealthCheckRecord["status"]): HealthTone {
  if (status === "healthy") {
    return "good";
  }

  if (status === "degraded") {
    return "warn";
  }

  return "danger";
}

export function getIncidentTone(severity: IncidentRecord["severity"]): HealthTone {
  return severity === "critical" ? "danger" : "warn";
}

export function getServerHealthSummary(server: ServerRecord, incidents: IncidentRecord[]) {
  const unresolved = incidents.filter(
    (incident) => incident.status === "open" || incident.status === "remediation_pending",
  );

  if (unresolved.some((incident) => incident.severity === "critical")) {
    return {
      label: "Danger",
      tone: "danger" as const,
    };
  }

  if (unresolved.length > 0) {
    return {
      label: "Warn",
      tone: "warn" as const,
    };
  }

  if (server.onboardingStatus === "active") {
    return {
      label: "Good",
      tone: "good" as const,
    };
  }

  return {
    label: "Pending",
    tone: "neutral" as const,
  };
}
