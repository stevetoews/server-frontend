import type { HealthCheckRecord, IncidentRecord, ServerRecord } from "./api";

export type HealthTone = "danger" | "good" | "neutral" | "warn";

export function getToneClasses(tone: HealthTone) {
  if (tone === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-border bg-white text-muted-foreground";
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
  const unresolved = incidents.filter((incident) => incident.status !== "resolved");

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
