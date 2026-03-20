"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomer, getStats, getModels, updateCustomer, deleteCustomer, getApiBase } from "@/lib/api";
import type { CustomerProfile, CustomerStats, ModelConfig } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from "@/components/ui/dialog";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from "recharts";
import { ProfileSkeleton } from "@/components/Skeletons";

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];
const TT_STYLE = { backgroundColor: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: "6px", fontSize: "11px" };

const OBJECTIVE_OPTIONS = ["low_latency", "high_quality", "low_cost"];
const PRIVACY_OPTIONS = ["low", "standard", "high"];
const COST_SENSITIVITY_OPTIONS = ["low", "medium", "high"];

function MetricBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold font-mono stat-value ${accent || ""}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    objective: "",
    region: "",
    privacy_tier: "",
    latency_target_ms: 0,
    cost_sensitivity: "",
    forbidden_providers: "",
    allowed_providers: "",
  });

  useEffect(() => {
    Promise.all([getCustomer(id), getStats(id), getModels()])
      .then(([p, s, m]) => { setProfile(p); setStats(s); setModels(m); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const startEditing = useCallback(() => {
    if (!profile) return;
    setEditForm({
      objective: profile.objective,
      region: profile.constraints.region,
      privacy_tier: profile.constraints.privacy_tier,
      latency_target_ms: profile.performance.latency_target_ms,
      cost_sensitivity: profile.performance.cost_sensitivity,
      forbidden_providers: profile.constraints.forbidden_providers.join(", "),
      allowed_providers: profile.constraints.allowed_providers.join(", "),
    });
    setEditing(true);
  }, [profile]);

  const cancelEditing = () => setEditing(false);

  const saveEdits = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateCustomer(profile.customer_id, {
        objective: editForm.objective,
        constraints: {
          region: editForm.region,
          privacy_tier: editForm.privacy_tier,
          forbidden_providers: editForm.forbidden_providers.split(",").map(s => s.trim()).filter(Boolean),
          allowed_providers: editForm.allowed_providers.split(",").map(s => s.trim()).filter(Boolean),
        },
        performance: {
          latency_target_ms: editForm.latency_target_ms,
          cost_sensitivity: editForm.cost_sensitivity,
        },
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(id);
      router.push("/customers");
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
    }
  };

  const copyEndpoint = () => {
    const url = `${getApiBase()}/v1/${profile?.customer_id}/chat/completions`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !profile) {
    return <ProfileSkeleton />;
  }

  const endpointUrl = `${getApiBase()}/v1/${profile.customer_id}/chat/completions`;
  const modelData = stats ? Object.entries(stats.model_distribution).map(([name, value]) => ({ name, value })) : [];
  const costData = stats ? Object.entries(stats.cost_by_model).map(([name, cost]) => ({ name, cost: Number(cost.toFixed(6)) })) : [];
  const latencyData = stats ? Object.entries(stats.latency_by_model).map(([name, ms]) => ({ name, ms })) : [];
  const hourlyData = stats?.hourly_requests.slice(-24) || [];

  // Cost projection calculation (Fix #7)
  const projectionRequests = 10000;
  const avgCostPerRequest = stats && stats.total_requests > 0 ? stats.total_cost / stats.total_requests : 0;
  const premiumCostPerRequest = stats && stats.total_requests > 0
    ? (stats.total_cost + stats.cost_savings_vs_premium) / stats.total_requests
    : 0;
  const projectedModelGateCost = avgCostPerRequest * projectionRequests;
  const projectedPremiumCost = premiumCostPerRequest * projectionRequests;
  const projectedSavings = projectedPremiumCost - projectedModelGateCost;
  const savingsPercent = projectedPremiumCost > 0 ? ((projectedSavings / projectedPremiumCost) * 100) : 0;

  // Per-customer model mapping (Fix #6)
  const allTierModels: Record<string, string[]> = {};
  for (const [tier, modelList] of Object.entries(profile.routing_preferences)) {
    allTierModels[tier] = modelList;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{profile.customer_name}</h1>
            <Badge variant="outline" className="text-[9px]">{profile.use_case.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{profile.customer_id}</p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" size="sm" className="text-xs" onClick={startEditing}>
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              Edit Profile
            </Button>
          )}
          <Link href={`/customers/${id}/logs`}><Button variant="outline" size="sm" className="text-xs">Request Logs</Button></Link>
          <Link href={`/playground?customer=${id}`}><Button size="sm" className="text-xs">Playground</Button></Link>

          {/* Delete with confirmation (Fix #8) */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm" className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10" />
            }>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-background border border-border">
              <DialogHeader>
                <DialogTitle>Delete Customer</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{profile.customer_name}</strong>? This will remove the profile, routing configuration, and all associated data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" size="sm" />}>
                  Cancel
                </DialogClose>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Customer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Endpoint URL - prominent with copy button (Fix #3) */}
      <div className="relative bg-primary/5 border-2 border-primary/30 rounded-lg px-4 py-4 glow-cyan">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-1.5 font-medium">Customer API Endpoint</div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-foreground break-all">
                <span className="text-primary font-semibold">POST</span>{" "}{endpointUrl}
              </code>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Drop-in replacement for any OpenAI-compatible API call. Just change the URL.</p>
          </div>
          <Button
            size="sm"
            variant={copied ? "default" : "outline"}
            className={`flex-shrink-0 text-xs px-4 transition-all ${copied ? "bg-green-600 hover:bg-green-600 text-white border-green-600" : "border-primary/40 text-primary hover:bg-primary/10"}`}
            onClick={copyEndpoint}
          >
            {copied ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                Copy URL
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Edit Mode Banner */}
      {editing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            <span className="text-xs text-amber-300 font-medium">Edit Mode</span>
            <span className="text-[10px] text-amber-300/60">Review and modify profile fields, then save</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={cancelEditing} disabled={saving}>Cancel</Button>
            <Button size="sm" className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-black" onClick={saveEdits} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      {stats && stats.total_requests > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <MetricBox label="Requests" value={stats.total_requests.toLocaleString()} />
          <MetricBox label="Avg Latency" value={`${stats.avg_latency_ms.toFixed(0)}ms`} />
          <MetricBox label="P95 Latency" value={`${stats.p95_latency_ms}ms`} />
          <MetricBox label="P99 Latency" value={`${stats.p99_latency_ms}ms`} />
          <MetricBox label="Avg TTFT" value={`${stats.avg_ttft_ms.toFixed(0)}ms`} />
          <MetricBox label="Total Cost" value={`$${stats.total_cost.toFixed(4)}`} />
          <MetricBox label="Savings" value={`$${stats.cost_savings_vs_premium.toFixed(4)}`} accent="text-green-400" sub="vs premium" />
          <MetricBox label="Success" value={`${stats.success_rate}%`} accent={stats.success_rate >= 99 ? "text-green-400" : "text-amber-400"} />
        </div>
      )}

      {/* Cost Projection (Fix #7) */}
      {stats && stats.total_requests > 0 && (
        <Card className="bg-gradient-to-r from-green-500/5 via-card/50 to-cyan-500/5 border-green-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-green-400">Cost Projection</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground mb-1">Monthly Volume</div>
                <div className="text-lg font-bold font-mono">{projectionRequests.toLocaleString()}</div>
                <div className="text-[9px] text-muted-foreground">requests/month</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground mb-1">With ModelGate</div>
                <div className="text-lg font-bold font-mono text-green-400">${projectedModelGateCost.toFixed(2)}</div>
                <div className="text-[9px] text-muted-foreground">smart routing</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground mb-1">Without (Always Premium)</div>
                <div className="text-lg font-bold font-mono text-red-400">${projectedPremiumCost.toFixed(2)}</div>
                <div className="text-[9px] text-muted-foreground">always best model</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground mb-1">Projected Savings</div>
                <div className="text-lg font-bold font-mono text-cyan-400">${projectedSavings.toFixed(2)}</div>
                <div className="text-[9px] text-green-400 font-medium">{savingsPercent.toFixed(0)}% cost reduction</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {stats && stats.total_requests > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Timeline */}
          <Card className="lg:col-span-2 bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Request Timeline</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourlyData}>
                  <defs><linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v: string) => v.split(" ")[1] || v} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Area type="monotone" dataKey="count" stroke="#38bdf8" fill="url(#tGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Model distribution */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Model Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={modelData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                    {modelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1">
                {modelData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1 text-[10px]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cost & Latency by model */}
      {stats && stats.total_requests > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Cost by Model</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={costData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                    {costData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Avg Latency by Model</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={latencyData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="ms" radius={[4, 4, 0, 0]}>
                    {latencyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Constraints + Routing Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Constraints */}
        <Card className={`bg-card/50 border-border/50 ${editing ? "ring-1 ring-amber-500/30" : ""}`}>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Contract Constraints</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              /* Edit mode */
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Objective</label>
                  <select
                    value={editForm.objective}
                    onChange={(e) => setEditForm(prev => ({ ...prev, objective: e.target.value }))}
                    className="w-full mt-1 bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs text-foreground"
                  >
                    {OBJECTIVE_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Region</label>
                  <Input
                    value={editForm.region}
                    onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
                    className="mt-1 bg-secondary/30 border-border/50 text-xs h-8"
                    placeholder="e.g., EU-only, US-only, any"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Privacy Tier</label>
                  <select
                    value={editForm.privacy_tier}
                    onChange={(e) => setEditForm(prev => ({ ...prev, privacy_tier: e.target.value }))}
                    className="w-full mt-1 bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs text-foreground"
                  >
                    {PRIVACY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Latency Target (ms)</label>
                  <Input
                    type="number"
                    value={editForm.latency_target_ms}
                    onChange={(e) => setEditForm(prev => ({ ...prev, latency_target_ms: Number(e.target.value) }))}
                    className="mt-1 bg-secondary/30 border-border/50 text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Cost Sensitivity</label>
                  <select
                    value={editForm.cost_sensitivity}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cost_sensitivity: e.target.value }))}
                    className="w-full mt-1 bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs text-foreground"
                  >
                    {COST_SENSITIVITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Forbidden Providers</label>
                  <Input
                    value={editForm.forbidden_providers}
                    onChange={(e) => setEditForm(prev => ({ ...prev, forbidden_providers: e.target.value }))}
                    className="mt-1 bg-secondary/30 border-border/50 text-xs h-8"
                    placeholder="e.g., deepseek, google (comma-separated)"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Allowed Providers</label>
                  <Input
                    value={editForm.allowed_providers}
                    onChange={(e) => setEditForm(prev => ({ ...prev, allowed_providers: e.target.value }))}
                    className="mt-1 bg-secondary/30 border-border/50 text-xs h-8"
                    placeholder="e.g., openai, anthropic (comma-separated, empty = all)"
                  />
                </div>
              </div>
            ) : (
              /* View mode */
              <>
                {[
                  { label: "Region", value: profile.constraints.region, color: "text-blue-400" },
                  { label: "Privacy Tier", value: profile.constraints.privacy_tier, color: profile.constraints.privacy_tier === "high" ? "text-red-400" : "text-gray-400" },
                  { label: "Objective", value: profile.objective.replace(/_/g, " "), color: "text-cyan-400" },
                  { label: "Latency Target", value: `${profile.performance.latency_target_ms}ms`, color: "" },
                  { label: "Cost Sensitivity", value: profile.performance.cost_sensitivity, color: "" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-xs font-medium font-mono ${color}`}>{value}</span>
                  </div>
                ))}
                {profile.constraints.allowed_providers.length > 0 && (
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-[10px] text-muted-foreground mb-1.5">Allowed Providers</div>
                    <div className="flex gap-1.5">
                      {profile.constraints.allowed_providers.map((p) => (
                        <Badge key={p} variant="outline" className="text-[9px] border-green-500/30 text-green-400">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile.constraints.forbidden_providers.length > 0 && (
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-[10px] text-muted-foreground mb-1.5">Blocked Providers</div>
                    <div className="flex gap-1.5">
                      {profile.constraints.forbidden_providers.map((p) => (
                        <Badge key={p} variant="outline" className="text-[9px] border-red-500/30 text-red-400">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Routing Preferences with model details (Fix #6) */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Routing Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(profile.routing_preferences).map(([tier, tierModels]) => (
              <div key={tier} className="space-y-1.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] w-16 justify-center flex-shrink-0 ${
                    tier === "simple" ? "border-green-500/30 text-green-400"
                    : tier === "complex" ? "border-red-500/30 text-red-400"
                    : "border-amber-500/30 text-amber-400"
                  }`}>{tier}</Badge>
                  <div className="text-[9px] text-muted-foreground">
                    {tier === "simple" ? "Fast, low-cost queries" : tier === "medium" ? "Moderate analysis" : "Complex reasoning"}
                  </div>
                </div>
                <div className="ml-[4.5rem] space-y-1">
                  {tierModels.map((m, i) => {
                    const modelInfo = models.find(mod => mod.model_name === m);
                    const isEnabled = modelInfo ? modelInfo.enabled : true;
                    return (
                      <div key={m} className={`flex items-center justify-between text-[10px] px-2 py-1 rounded ${!isEnabled ? "opacity-40 line-through" : ""} ${i === 0 ? "bg-primary/5 border border-primary/10" : "bg-secondary/20"}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{m}</span>
                          {i === 0 && <Badge className="text-[7px] h-3 px-1 bg-primary/20 text-primary border-0">primary</Badge>}
                          {!isEnabled && <Badge className="text-[7px] h-3 px-1 bg-red-500/20 text-red-400 border-0">disabled</Badge>}
                        </div>
                        {modelInfo && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>${modelInfo.cost_per_m_input}/M in</span>
                            <span>{modelInfo.avg_latency_ms}ms</span>
                            <span>{modelInfo.provider}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-amber-400">Contract Warnings</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {profile.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300/80 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">&#9651;</span>{w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Token stats */}
      {stats && stats.total_requests > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Token Usage</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold font-mono stat-value">{stats.total_tokens.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono stat-value text-blue-400">{stats.total_input_tokens.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">Input Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono stat-value text-green-400">{stats.total_output_tokens.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">Output Tokens</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
