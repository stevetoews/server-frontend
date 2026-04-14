import { getIncidents } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const payload = await getIncidents();

  return <DashboardShell incidents={payload.data.incidents} />;
}
