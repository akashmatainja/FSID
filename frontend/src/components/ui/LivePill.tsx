"use client";

/** "OPC UA live" status pill with a pulsing dot. */
export default function LivePill({ live, label = "OPC UA live", offLabel = "Connecting…" }: {
  live: boolean;
  label?: string;
  offLabel?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-bold transition-colors ${
        live
          ? "bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/40"
          : "bg-muted text-muted-foreground border-border"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {live && <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 animate-live-ring" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-brand-500" : "bg-muted-foreground/60"}`} />
      </span>
      {live ? label : offLabel}
    </span>
  );
}
