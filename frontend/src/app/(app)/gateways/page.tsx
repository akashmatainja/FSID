"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Router, Plus, KeyRound, Power, Trash2, Copy, Check, X, ChevronDown, ChevronRight, AlertTriangle, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, relativeTime } from "@/lib/utils";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import type { Gateway } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border/60 bg-card/50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50";

function statusOf(g: Gateway): { label: string; cls: string } {
  if (!g.is_active) return { label: "disabled", cls: "bg-muted !text-muted-foreground" };
  if (!g.last_seen_at) return { label: "never connected", cls: "badge-info" };
  if (!g.online) return { label: "offline", cls: "badge-danger" };
  if (g.status && g.status.opcua_connected === false) return { label: "OPC UA down", cls: "badge-warning" };
  if ((g.status?.nodes_bad ?? 0) > 0) return { label: "tags failing", cls: "badge-warning" };
  return { label: "online", cls: "badge-success" };
}

function rowClass(g: Gateway) {
  const s = statusOf(g).label;
  if (s === "offline") return "row-critical";
  if (s === "OPC UA down" || s === "tags failing") return "row-warning";
  return "";
}

/** Shows a freshly created/rotated key once, with a ready-to-paste config. */
function KeyModal({ gateway, apiKey, onClose }: { gateway: Gateway; apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const config = JSON.stringify(
    {
      api_url: API_URL,
      api_key: apiKey,
      opcua: { endpoint: "opc.tcp://<plant-opc-server>:4840", security_policy: "None", security_mode: "None", username: "", password: "" },
      log_file: "gateway.log",
    },
    null,
    2
  );
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed — select the text and copy it manually");
    }
  };
  return (
    <Modal title={`API key for "${gateway.name}"`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>Copy this key now. It is shown only once; if you lose it, rotate the key and update the gateway.</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm break-all rounded-lg bg-muted px-3 py-2 border border-border">{apiKey}</code>
          <button className="btn-secondary !px-3" onClick={() => copy(apiKey, "key")}>
            {copied === "key" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">gateway.json for the plant PC (fill in the OPC UA server)</span>
            <button className="btn-secondary !px-3 !py-1" onClick={() => copy(config, "config")}>
              {copied === "config" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
            </button>
          </div>
          <pre className="font-mono text-xs rounded-lg bg-muted p-3 border border-border overflow-x-auto">{config}</pre>
        </div>
        <p className="text-sm text-muted-foreground">
          Setup steps are in <code className="font-mono">gateway/README.md</code>. Run <code className="font-mono">fsid-gateway -once</code> on
          the plant PC to check that every tag can be read before starting it for real.
        </p>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={onClose}>I&apos;ve saved the key</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function GatewaysPage() {
  const { permissions } = useAuth();
  const canWrite = !!permissions["machines.write"];

  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", poll: "5" });
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<{ gateway: Gateway; key: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "rotate" | "delete"; gateway: Gateway } | null>(null);

  const load = useCallback(async () => {
    try {
      setGateways(await api.get<Gateway[]>("/api/v1/gateways"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gateways");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    const poll = Number(form.poll);
    if (!form.name.trim()) return toast.error("Name is required");
    if (!Number.isInteger(poll) || poll < 1 || poll > 3600) return toast.error("Poll interval must be 1–3600 seconds");
    setSaving(true);
    try {
      const res = await api.post<{ gateway: Gateway; api_key: string }>("/api/v1/gateways", { name: form.name.trim(), poll_interval_seconds: poll });
      setCreating(false);
      setForm({ name: "", poll: "5" });
      setNewKey({ gateway: res.gateway, key: res.api_key });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create gateway");
    } finally {
      setSaving(false);
    }
  };

  const update = async (g: Gateway, body: Partial<Pick<Gateway, "is_active" | "poll_interval_seconds">>) => {
    try {
      await api.put(`/api/v1/gateways/${g.id}`, body);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, gateway } = confirm;
    setConfirm(null);
    try {
      if (kind === "rotate") {
        const res = await api.post<{ gateway: Gateway; api_key: string }>(`/api/v1/gateways/${gateway.id}/rotate-key`, {});
        setNewKey({ gateway, key: res.api_key });
      } else {
        await api.delete(`/api/v1/gateways/${gateway.id}`);
        toast.success("Gateway deleted");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">OPC UA Gateways</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edge gateways read your plant&apos;s OPC UA servers and send live machine data here over HTTPS
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {canWrite && (
            <button onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add gateway
            </button>
          )}
        </div>
      </div>

      <section className="glass-card overflow-hidden">
        {loading ? (
          <EnergyPulseLoader text="Loading gateways..." />
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : gateways.length === 0 ? (
          <div className="p-10 max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Router className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-extrabold text-foreground text-center mb-4">No gateways yet</h3>
            <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
              <li>Add a gateway here and copy its API key (one gateway per plant OPC UA server).</li>
              <li>Install <code className="font-mono">fsid-gateway</code> on a PC in the plant that can reach the OPC UA server and the internet.</li>
              <li>On each machine&apos;s page, choose this gateway and set the OPC UA node ID for each metric (or set a template per metric on the Modules page).</li>
              <li>Run <code className="font-mono">fsid-gateway -once</code> to check the tags, then start it as a service.</li>
            </ol>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left whitespace-nowrap">
              <thead>
                <tr>
                  <th className="p-3 pl-6">Gateway</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Machines</th>
                  <th className="p-3">Tags</th>
                  <th className="p-3 text-right">Buffered</th>
                  <th className="p-3">Last seen</th>
                  <th className="p-3">Poll</th>
                  {canWrite && <th className="p-3 pr-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {gateways.map((g) => {
                  const st = statusOf(g);
                  const open = expanded === g.id;
                  const bad = g.status?.nodes_bad ?? 0;
                  const ok = g.status?.nodes_ok ?? 0;
                  return (
                    <Fragment key={g.id}>
                      <tr className={`${rowClass(g)} cursor-pointer`} onClick={() => setExpanded(open ? null : g.id)}>
                        <td className="p-3 pl-6">
                          <div className="flex items-center gap-2">
                            {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                            <div>
                              <div className="text-foreground">{g.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{g.key_prefix}…</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="p-3 text-right tabular cell-key">{g.machine_count}</td>
                        <td className="p-3 tabular">
                          {g.status ? (
                            <span>
                              <span className="text-foreground">{ok}</span> ok
                              {bad > 0 && <span className="cell-danger ml-2">{bad} failing</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={`p-3 text-right tabular ${(g.status?.buffered ?? 0) > 0 ? "cell-warning" : "text-muted-foreground"}`}>
                          {(g.status?.buffered ?? 0).toLocaleString()}
                        </td>
                        <td className="p-3 tabular text-muted-foreground" title={g.last_seen_at ? relativeTime(g.last_seen_at) : undefined}>
                          {formatDateTime(g.last_seen_at)}
                        </td>
                        <td className="p-3 tabular text-muted-foreground">{g.poll_interval_seconds}s</td>
                        {canWrite && (
                          <td className="p-3 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              <IconBtn title={g.is_active ? "Disable" : "Enable"} onClick={() => update(g, { is_active: !g.is_active })}>
                                <Power className={`w-4 h-4 ${g.is_active ? "text-brand-500" : ""}`} />
                              </IconBtn>
                              <IconBtn title="Rotate API key" onClick={() => setConfirm({ kind: "rotate", gateway: g })}>
                                <KeyRound className="w-4 h-4" />
                              </IconBtn>
                              <IconBtn title="Delete" onClick={() => setConfirm({ kind: "delete", gateway: g })}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </IconBtn>
                            </div>
                          </td>
                        )}
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={canWrite ? 8 : 7} className="p-0 whitespace-normal">
                            <GatewayDetails g={g} canWrite={canWrite} onPoll={(s) => update(g, { poll_interval_seconds: s })} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {creating && (
          <Modal title="Add gateway" onClose={() => setCreating(false)}>
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">Name</span>
                <input autoFocus className={inputCls} value={form.name} placeholder="e.g. Plant 1 — Line A SCADA"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">Read every (seconds)</span>
                <input className={`${inputCls} max-w-[160px]`} inputMode="numeric" value={form.poll}
                  onChange={(e) => setForm({ ...form, poll: e.target.value })} />
              </label>
              <p className="text-sm text-muted-foreground">Use one gateway per plant OPC UA server. You&apos;ll get an API key to put on the plant PC.</p>
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={create}>{saving ? "Creating…" : "Create gateway"}</button>
              </div>
            </div>
          </Modal>
        )}
        {newKey && <KeyModal gateway={newKey.gateway} apiKey={newKey.key} onClose={() => setNewKey(null)} />}
        {confirm && (
          <Modal title={confirm.kind === "rotate" ? "Rotate API key?" : "Delete gateway?"} onClose={() => setConfirm(null)}>
            <p className="text-sm text-muted-foreground mb-5">
              {confirm.kind === "rotate"
                ? `The current key for "${confirm.gateway.name}" stops working immediately. The gateway keeps its readings buffered until you put the new key in its gateway.json and restart it.`
                : `"${confirm.gateway.name}" will stop sending data and its ${confirm.gateway.machine_count} machine(s) will be unassigned. Stored readings are kept.`}
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={confirm.kind === "delete" ? "btn-primary !bg-red-600" : "btn-primary"} onClick={runConfirm}>
                {confirm.kind === "rotate" ? "Rotate key" : "Delete"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="p-2 rounded-lg border border-border bg-card hover:border-brand-500/50 transition-colors">
      {children}
    </button>
  );
}

function GatewayDetails({ g, canWrite, onPoll }: { g: Gateway; canWrite: boolean; onPoll: (s: number) => void }) {
  const s = g.status;
  const [poll, setPoll] = useState(String(g.poll_interval_seconds));
  const item = (label: string, value: React.ReactNode) => (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-foreground break-all">{value ?? "—"}</div>
    </div>
  );
  return (
    <div className="bg-muted/40 px-6 py-4 space-y-4 border-b border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {item("OPC UA server", s?.opcua_endpoint)}
        {item("Security", s ? `${s.security_policy ?? "?"} / ${s.security_mode ?? "?"}` : null)}
        {item("OPC UA connection", s ? (s.opcua_connected ? "connected" : "not connected") : null)}
        {item("Agent", s ? `v${s.agent_version ?? "?"} on ${s.hostname ?? "?"}` : null)}
        {item("Public IP", g.last_ip)}
        {item("Last read", formatDateTime(s?.last_poll_at))}
        {item("Last upload", formatDateTime(s?.last_upload_at))}
        {item("Readings sent (since start)", s?.readings_sent?.toLocaleString())}
      </div>
      {(s?.opcua_error || s?.upload_error || (s?.dropped ?? 0) > 0) && (
        <div className="space-y-1 text-sm">
          {s?.opcua_error && <p className="cell-danger">OPC UA: {s.opcua_error}</p>}
          {s?.upload_error && <p className="cell-danger">Upload: {s.upload_error}</p>}
          {(s?.dropped ?? 0) > 0 && <p className="cell-warning">{s!.dropped!.toLocaleString()} reading(s) dropped because the offline buffer was full.</p>}
        </div>
      )}
      {s?.node_problems && s.node_problems.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Tags that could not be read</div>
          <ul className="text-sm space-y-1">
            {s.node_problems.map((p, i) => (
              <li key={i}>
                <span className="text-foreground">{p.machine_code} · {p.metric_key}</span>{" "}
                <code className="font-mono text-xs text-muted-foreground">{p.node_id}</code>{" "}
                <span className="cell-danger">{p.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canWrite && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Read every</span>
          <input className={`${inputCls} !w-24`} inputMode="numeric" value={poll} onChange={(e) => setPoll(e.target.value)} />
          <span className="text-muted-foreground">seconds</span>
          <button
            className="btn-secondary !py-1.5"
            disabled={poll === String(g.poll_interval_seconds)}
            onClick={() => {
              const n = Number(poll);
              if (!Number.isInteger(n) || n < 1 || n > 3600) return toast.error("Poll interval must be 1–3600 seconds");
              onPoll(n);
            }}
          >
            Save
          </button>
          <span className="text-muted-foreground">(the gateway picks it up within a minute)</span>
        </div>
      )}
    </div>
  );
}
