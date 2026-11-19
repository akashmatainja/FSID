"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Router, Save, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import CustomSelect, { type SelectOption } from "@/components/ui/CustomSelect";
import type { Gateway, MachineOpcua } from "@/types";

/**
 * Which edge gateway reads this machine and which OPC UA node each metric
 * comes from. A per-machine node ID overrides the metric's template (set on
 * the Modules page); gateways pick up changes within about a minute.
 */
export default function OpcuaMappingCard({ machineId, companyId, canEdit }: { machineId: string; companyId: string; canEdit: boolean }) {
  const [data, setData] = useState<MachineOpcua | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gatewayId, setGatewayId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (d: MachineOpcua) => {
    setData(d);
    setGatewayId(d.gateway_id ?? "");
    setOverrides(Object.fromEntries(d.metrics.map((m) => [m.metric_id, m.override ?? ""])));
  };

  useEffect(() => {
    let alive = true;
    Promise.all([api.get<MachineOpcua>(`/api/v1/machines/${machineId}/opcua`), api.get<Gateway[]>("/api/v1/gateways")])
      .then(([d, g]) => {
        if (!alive) return;
        apply(d);
        setGateways(g.filter((x) => x.company_id === companyId)); // superadmins see every company's gateways
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load OPC UA settings"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [machineId, companyId]);

  const dirty = useMemo(() => {
    if (!data) return false;
    if ((data.gateway_id ?? "") !== gatewayId) return true;
    return data.metrics.some((m) => (m.override ?? "") !== (overrides[m.metric_id] ?? ""));
  }, [data, gatewayId, overrides]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const nodes = data.metrics
        .filter((m) => (m.override ?? "") !== (overrides[m.metric_id] ?? ""))
        .map((m) => ({ metric_id: m.metric_id, node_id: (overrides[m.metric_id] ?? "").trim() }));
      apply(await api.put<MachineOpcua>(`/api/v1/machines/${machineId}/opcua`, { gateway_id: gatewayId || null, nodes }));
      toast.success("OPC UA settings saved — the gateway applies them within a minute");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const gatewayOptions: SelectOption[] = [
    { value: "", label: "Not read by a gateway" },
    ...gateways.map((g) => ({ value: g.id, label: `${g.name}${g.is_active ? "" : " (disabled)"}` })),
  ];
  const selected = gateways.find((g) => g.id === gatewayId);
  const mapped = data?.metrics.filter((m) => {
    const o = (overrides[m.metric_id] ?? "").trim();
    return o || m.template;
  }).length ?? 0;

  return (
    <section className="glass-card overflow-hidden relative z-10">
      <div className="p-6 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-extrabold text-foreground flex items-center gap-2">
          <Router className="w-5 h-5" /> Live data source (OPC UA)
        </h3>
        {canEdit && data && (
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={!dirty || saving} onClick={() => apply(data)}>
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button className="btn-primary" disabled={!dirty || saving} onClick={save}>
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-9" />)}
        </div>
      ) : error ? (
        <p className="p-6 text-sm cell-danger">{error}</p>
      ) : data && (
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Read by</span>
            <div className="w-full sm:w-80">
              <CustomSelect value={gatewayId} onChange={setGatewayId} options={gatewayOptions} disabled={!canEdit} />
            </div>
            {selected && (
              <span className={`badge ${selected.online ? "badge-success" : "badge-danger"}`}>{selected.online ? "gateway online" : "gateway offline"}</span>
            )}
            {gateways.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No gateways yet — <Link href="/gateways" className="text-brand-500 underline">add one</Link>.
              </span>
            )}
          </div>

          {data.metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">This machine has no module metrics yet. Assign a module to it first.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="data-table w-full text-left">
                  <thead>
                    <tr>
                      <th className="p-3">Metric</th>
                      <th className="p-3">Module template</th>
                      <th className="p-3">OPC UA node ID for this machine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.metrics.map((m) => {
                      const value = overrides[m.metric_id] ?? "";
                      const missing = !value.trim() && !m.template;
                      return (
                        <tr key={m.metric_id} className={gatewayId && missing ? "row-warning" : ""}>
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-foreground">{m.metric_name}{m.unit && <span className="text-muted-foreground"> ({m.unit})</span>}</div>
                            <div className="text-xs text-muted-foreground font-mono">{m.metric_code} · {m.module_name}</div>
                          </td>
                          <td className="p-3">
                            {m.template ? (
                              <code className="font-mono text-xs text-muted-foreground break-all">{m.template}</code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 min-w-[280px]">
                            {canEdit ? (
                              <input
                                value={value}
                                onChange={(e) => setOverrides({ ...overrides, [m.metric_id]: e.target.value })}
                                placeholder={m.template ? `uses template: ${m.effective}` : "e.g. ns=2;s=Line1.Motor3.Voltage"}
                                className="w-full px-3 py-1.5 rounded-lg border border-border/60 bg-card font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                              />
                            ) : (
                              <code className="font-mono text-sm">{m.effective || "—"}</code>
                            )}
                            {missing && gatewayId && <div className="text-xs cell-warning mt-1">Not read — set a node ID</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                {mapped} of {data.metrics.length} metric(s) will be read.
                Leave a field empty to use the module template. Find node IDs by browsing the OPC UA server (e.g. with UaExpert).
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
