import { Card } from "@/components/ui/card";

interface ServerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ServerDetailPage({ params }: ServerDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Server Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{id}</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-2 xl:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Onboarding state</h2>
          <p className="text-sm text-muted-foreground">
            Show SSH verification, discovery output, provider match confirmation, and SpinupWP mapping status here.
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Recent checks</h2>
          <p className="text-sm text-muted-foreground">
            Deterministic check results and remediation runs will land in this panel.
          </p>
        </Card>
      </div>
    </div>
  );
}
