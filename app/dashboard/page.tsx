import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getIncidents } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const cookieStore = await cookies();

  try {
    const payload = await getIncidents({
      cookie: cookieStore.toString(),
    });

    return <DashboardShell incidents={payload.data.incidents} />;
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    throw error;
  }
}
