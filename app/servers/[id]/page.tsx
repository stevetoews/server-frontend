import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ServerDetailView } from "@/components/servers/server-detail-view";
import { getServer, getServerActivity, getServerIncidents, getServerSites, getServerWordops } from "@/lib/api";

interface ServerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    eventType?: string | string[];
    kind?: string | string[];
  }>;
}

function firstQueryValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ServerDetailPage({ params, searchParams }: ServerDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const { eventType, kind } = await searchParams;
  const activityKindValue = firstQueryValue(kind);
  const activityEventTypeValue = firstQueryValue(eventType);
  const activityKind =
    activityKindValue === "audit" || activityKindValue === "incident" || activityKindValue === "remediation"
      ? activityKindValue
      : "all";
  const activityEventType = activityEventTypeValue?.trim() ?? "";
  let payload;

  try {
    payload = await getServer(id, {
      cookie: cookieStore.toString(),
    });
  } catch (error) {
    if (error instanceof Error && /authentication is required|session was not valid/i.test(error.message)) {
      redirect("/login");
    }

    throw error;
  }

  const server = payload.data.server;
  const [incidentsPayload, activityPayload, wordopsResult, sitesResult] = await Promise.all([
    getServerIncidents(id, {
      limit: 3,
      offset: 0,
      cookie: cookieStore.toString(),
    }),
    getServerActivity(id, {
      limit: 5,
      offset: 0,
      ...(activityKind !== "all" ? { kind: activityKind } : {}),
      ...(activityEventType ? { eventType: activityEventType } : {}),
      cookie: cookieStore.toString(),
    }),
    getServerWordops(id, {
      cookie: cookieStore.toString(),
    }).catch(() => ({
      data: {
        overview: {
          installed: false,
          sites: [],
          stack: {
            mysqlInstalled: false,
            nginxInstalled: false,
            phpInstalled: false,
            wpCliInstalled: false,
          },
          status: "error" as const,
        },
      },
    })),
    getServerSites(id, {
      cookie: cookieStore.toString(),
    }).catch(() => ({
      data: {
        sites: [],
      },
    })),
  ]);

  return (
    <ServerDetailView
      initialActivityEventType={activityEventType}
      initialActivityKindFilter={activityKind}
      initialActivity={activityPayload.data.items}
      initialActivityPagination={activityPayload.data.pagination ?? null}
      initialIncidents={incidentsPayload.data.incidents}
      initialIncidentsPagination={incidentsPayload.data.pagination ?? null}
      initialSites={sitesResult.data.sites}
      initialWordops={wordopsResult.data.overview}
      server={server}
    />
  );
}
