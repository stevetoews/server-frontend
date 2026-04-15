import { Card } from "@/components/ui/card";
import { NotificationTargetsPanel } from "@/components/settings/notification-targets-panel";

export function SettingsShell() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Integrations and policy controls
        </h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Configure Turso, Akamai, DigitalOcean, and notification delivery without exposing plaintext secrets in logs or UI payloads.
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Policies</h2>
          <p className="text-sm text-muted-foreground">
            Restrict remediation to approved service restarts and last-resort provider reboot actions.
          </p>
        </Card>
      </div>

      <NotificationTargetsPanel />
    </div>
  );
}
