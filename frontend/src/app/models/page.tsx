"use client";

import { useEffect, useState, useCallback } from "react";
import { getModels, updateModel, addModel, removeModel, searchOpenRouterModels } from "@/lib/api";
import type { ModelConfig, OpenRouterModel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ModelsSkeleton } from "@/components/Skeletons";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "border-amber-500/40 text-amber-400",
  openai: "border-green-500/40 text-green-400",
  google: "border-blue-500/40 text-blue-400",
  deepseek: "border-purple-500/40 text-purple-400",
  meta: "border-sky-500/40 text-sky-400",
  mistralai: "border-orange-500/40 text-orange-400",
  cohere: "border-rose-500/40 text-rose-400",
};

const TIER_COLORS: Record<string, string> = {
  simple: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  complex: "bg-red-500/15 text-red-400 border-red-500/30",
};

const TIER_OPTIONS = ["simple", "medium", "complex"];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Catalog search
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<OpenRouterModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingModel, setAddingModel] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    getModels().then(setModels).catch(console.error);
  }, []);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (model: ModelConfig) => {
    setUpdating(model.model_name);
    try {
      await updateModel(model.model_name, !model.enabled, model.description);
      setModels((prev) =>
        prev.map((m) =>
          m.model_name === model.model_name ? { ...m, enabled: !m.enabled } : m
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (modelName: string) => {
    setUpdating(modelName);
    try {
      await removeModel(modelName);
      setModels((prev) => prev.filter((m) => m.model_name !== modelName));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchOpenRouterModels(searchQuery);
      setCatalogResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (orModel: OpenRouterModel) => {
    const tier = selectedTier[orModel.id] || "medium";
    const friendlyName = slugify(orModel.name || orModel.id.split("/").pop() || orModel.id);
    setAddingModel(orModel.id);
    try {
      await addModel({
        model_name: friendlyName,
        provider: orModel.provider,
        openrouter_id: orModel.id,
        tier,
        cost_per_m_input: orModel.cost_per_m_input || 0,
        cost_per_m_output: orModel.cost_per_m_output || 0,
        avg_latency_ms: 500,
        regions: ["US", "EU"],
        max_context: orModel.context_length || 128000,
        description: `${orModel.name} via OpenRouter`,
      });
      refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingModel(null);
    }
  };

  if (loading) return <ModelsSkeleton />;

  const enabledCount = models.filter((m) => m.enabled).length;
  const providers = [...new Set(models.map((m) => m.provider))];
  const existingIds = new Set(models.map((m) => m.openrouter_id));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Model Registry</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure which models are available for customer routing
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <span>{enabledCount}/{models.length} enabled</span>
          <span>{providers.length} providers</span>
        </div>
      </div>

      {/* ── Provider summary ── */}
      <div className="flex gap-2 flex-wrap">
        {providers.map((p) => {
          const count = models.filter((m) => m.provider === p).length;
          const enabled = models.filter((m) => m.provider === p && m.enabled).length;
          return (
            <div key={p} className="bg-card/50 border border-border/50 rounded-lg px-4 py-2.5 flex items-center gap-3">
              <Badge variant="outline" className={`text-[10px] ${PROVIDER_COLORS[p] || "border-gray-500/40 text-gray-400"}`}>
                {p}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">{enabled}/{count}</span>
            </div>
          );
        })}
      </div>

      {/* ── Your Models ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Your Models</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {models.map((model) => (
            <Card
              key={model.model_name}
              className={`bg-card/50 border-border/50 transition-all ${
                model.enabled ? "opacity-100" : "opacity-50"
              } ${updating === model.model_name ? "animate-pulse" : ""}`}
            >
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{model.model_name}</h3>
                      <Badge variant="outline" className={`text-[9px] ${TIER_COLORS[model.tier] || ""}`}>
                        {model.tier}
                      </Badge>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${PROVIDER_COLORS[model.provider] || "border-gray-500/40 text-gray-400"}`}>
                      {model.provider}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={() => handleToggle(model)}
                      disabled={updating === model.model_name}
                    />
                    <button
                      onClick={() => handleRemove(model.model_name)}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove model"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{model.description}</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/30 rounded px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Input</div>
                    <div className="text-xs font-mono font-medium">${model.cost_per_m_input.toFixed(2)}/MTok</div>
                  </div>
                  <div className="bg-secondary/30 rounded px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Output</div>
                    <div className="text-xs font-mono font-medium">${model.cost_per_m_output.toFixed(2)}/MTok</div>
                  </div>
                  <div className="bg-secondary/30 rounded px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Latency</div>
                    <div className="text-xs font-mono font-medium">{model.avg_latency_ms}ms</div>
                  </div>
                  <div className="bg-secondary/30 rounded px-2.5 py-1.5">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Context</div>
                    <div className="text-xs font-mono font-medium">{(model.max_context / 1000).toFixed(0)}K</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {model.regions.map((r) => (
                      <Badge key={r} variant="outline" className="text-[9px] px-1.5">{r}</Badge>
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[140px]">
                    {model.openrouter_id}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Add from OpenRouter ── */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Add from OpenRouter
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Browse hundreds of models from OpenRouter and add them to your environment
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search models... (e.g., claude, gpt, llama, mistral, gemini)"
              className="bg-secondary/30 border-border/50"
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? (
                <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : "Search"}
            </Button>
          </div>

          {/* Results */}
          {catalogResults.length > 0 && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {catalogResults.map((orModel) => {
                const alreadyAdded = existingIds.has(orModel.id);
                const tier = selectedTier[orModel.id] || "medium";
                return (
                  <div
                    key={orModel.id}
                    className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-all ${
                      alreadyAdded
                        ? "border-green-500/20 bg-green-500/5 opacity-60"
                        : "border-border/30 bg-secondary/10 hover:bg-secondary/20"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{orModel.name || orModel.id}</span>
                        <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${PROVIDER_COLORS[orModel.provider] || "border-gray-500/40 text-gray-400"}`}>
                          {orModel.provider}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                        <span>${(orModel.cost_per_m_input || 0).toFixed(2)}/MTok in</span>
                        <span>${(orModel.cost_per_m_output || 0).toFixed(2)}/MTok out</span>
                        <span>{((orModel.context_length || 0) / 1000).toFixed(0)}K ctx</span>
                      </div>
                    </div>

                    {alreadyAdded ? (
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[9px] flex-shrink-0">
                        Added
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Tier selector */}
                        <div className="flex gap-0.5">
                          {TIER_OPTIONS.map((t) => (
                            <button
                              key={t}
                              onClick={() => setSelectedTier((prev) => ({ ...prev, [orModel.id]: t }))}
                              className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                                tier === t
                                  ? t === "simple" ? "bg-green-500/20 text-green-400"
                                    : t === "complex" ? "bg-red-500/20 text-red-400"
                                    : "bg-amber-500/20 text-amber-400"
                                  : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="text-[10px] h-7 px-3"
                          onClick={() => handleAdd(orModel)}
                          disabled={addingModel === orModel.id}
                        >
                          {addingModel === orModel.id ? (
                            <span className="animate-spin h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {catalogResults.length === 0 && searchQuery && !searching && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No results. Try searching for a model name like &quot;claude&quot;, &quot;gpt&quot;, &quot;llama&quot;, or &quot;mistral&quot;.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
