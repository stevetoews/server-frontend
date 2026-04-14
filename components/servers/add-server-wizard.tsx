import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  "Draft server record",
  "Test SSH",
  "Discover host metadata",
  "Require provider match",
  "Allow SpinupWP mapping",
  "Start health checks",
];

export function AddServerWizard() {
  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Onboarding Flow
          </p>
          <h2 className="text-xl font-semibold text-foreground">Add server</h2>
        </div>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li className="flex items-start gap-3" key={step}>
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{step}</p>
                <p className="text-xs text-muted-foreground">
                  {index === 3
                    ? "Activation remains blocked until Linode or DigitalOcean is confirmed."
                    : "Wizard shell step ready for backend integration."}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              SSH-first onboarding
            </h1>
            <p className="text-sm text-muted-foreground">
              Capture the draft record first, then move into verification, discovery, provider matching, and post-match SpinupWP linking.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Server name</span>
              <input className="h-12 rounded-2xl border border-border bg-white px-4 text-sm" placeholder="wp-prod-01" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Environment</span>
              <select className="h-12 rounded-2xl border border-border bg-white px-4 text-sm">
                <option>production</option>
                <option>staging</option>
                <option>development</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Hostname</span>
              <input className="h-12 rounded-2xl border border-border bg-white px-4 text-sm" placeholder="host.example.com" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Public IP</span>
              <input className="h-12 rounded-2xl border border-border bg-white px-4 text-sm" placeholder="203.0.113.10" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">SSH user</span>
              <input className="h-12 rounded-2xl border border-border bg-white px-4 text-sm" placeholder="root" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">SSH auth mode</span>
              <select className="h-12 rounded-2xl border border-border bg-white px-4 text-sm">
                <option>private_key</option>
                <option>passwordless_agent</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Notes</span>
            <textarea
              className="min-h-32 w-full rounded-[1.5rem] border border-border bg-white px-4 py-3 text-sm"
              placeholder="Internal notes, maintenance windows, or escalation context"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="button">Save Draft and Test SSH</Button>
            <Button type="button" variant="secondary">
              Preview Provider Matching
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Provider match gate</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Linode candidate: wp-prod-01-linode",
              "DigitalOcean candidate: wp-prod-01-droplet",
            ].map((item) => (
              <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground" key={item}>
                {item}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            SpinupWP mapping controls should stay disabled until one of the primary provider matches is explicitly confirmed.
          </p>
        </Card>
      </div>
    </div>
  );
}
