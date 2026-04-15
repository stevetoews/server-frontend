import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getIncident, getServerChecks } from "@/lib/api";
import { IncidentDetailView } from "@/components/incidents/incident-detail-view";

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();

  try {
    const payload = await getIncident(id, {
      cookie: cookieStore.toString(),
    });

    const { incident, server, audits, remediations } = payload.data;
    const serverChecksPayload = await getServerChecks(server.id, {
      limit: 3,
      offset: 0,
      cookie: cookieStore.toString(),
    });

    return (
      <IncidentDetailView
        audits={audits}
        incident={incident}
        remediations={remediations}
        serverChecks={serverChecksPayload.data.checks}
        serverChecksPagination={serverChecksPayload.data.pagination ?? null}
        server={server}
      />
    );
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    if (error instanceof Error && /incident record was not found/i.test(error.message)) {
      notFound();
    }

    throw error;
  }
}
