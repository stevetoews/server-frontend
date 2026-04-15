import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getIncident } from "@/lib/api";
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

    return (
      <IncidentDetailView
        audits={audits}
        incident={incident}
        remediations={remediations}
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
