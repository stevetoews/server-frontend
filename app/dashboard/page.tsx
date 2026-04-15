import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getIncidents, getServers } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const cookieStore = await cookies();

  try {
    const [incidentsPayload, serversPayload] = await Promise.all([
      getIncidents({
        cookie: cookieStore.toString(),
      }),
      getServers({
        cookie: cookieStore.toString(),
      }),
    ]);

    return <DashboardShell incidents={incidentsPayload.data.incidents} servers={serversPayload.data} />;
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    throw error;
  }
}
