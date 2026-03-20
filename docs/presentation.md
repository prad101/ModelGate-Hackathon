# ModelGate — Presentation Content
## KSU Social Good Hackathon 2026 · Assurant Track

---

## SLIDE 1 — Title

**ModelGate**
*The Fastest Way to Cut Your AI Costs — One Line of Code*

> From signed contract to intelligent AI endpoint — automatically.

KSU Social Good Hackathon 2026 · Assurant Track

---

## SLIDE 2 — The Real Problem With AI Today

Everyone is moving fast in AI.

Nobody has time to:
- Evaluate 200+ available models
- Read contracts to find provider restrictions
- Figure out which model is right for which query
- Track what AI is costing you in real time
- Keep up with the model landscape as it changes weekly

**So everyone does the same thing:**
They pick one premium model, point everything at it, and never revisit it.

> That one decision wastes 60–98% of their AI budget.
> Every single day.

---

## SLIDE 3 — The One-Line Fix

### You don't need to redesign your AI infrastructure.

**Before ModelGate:**
```python
client = OpenAI(
    api_key="sk-...",
    base_url="https://api.openai.com/v1"
)
```

**After ModelGate:**
```python
client = OpenAI(
    api_key="<your-token>",
    base_url="https://your-modelgate-endpoint/v1"  # ← this is the one line
)
```

**That's it.**
Same API. Same message format. Same response shape.

ModelGate intercepts your requests, classifies them, applies your contract constraints, routes each one to the right model, and returns the answer — exactly as if you called OpenAI directly.

**You change one line. We handle everything else.**

---

## SLIDE 4 — Everyone Wins

### ModelGate is the rare optimization that benefits every layer of the stack

| Layer | How ModelGate Helps |
|-------|---------------------|
| **Your business** | 60–98% reduction in AI inference costs |
| **Your users** | Faster responses — simple queries go to fast models, not slow ones |
| **Your compliance team** | Contract constraints are enforced automatically in routing |
| **AI data centers** | Less load on overprovisioned GPU clusters running premium models |
| **The planet** | Premium models use up to 180x more energy per query than small models |

> This isn't just a cost optimization.
> It's a resource efficiency improvement at every level of the AI pipeline.

---

## SLIDE 5 — The Scale of the Waste

| Stat | Source |
|------|--------|
| **50–90%** of enterprise AI inference spend is addressable through right-sizing | LeanLLM.ai |
| Only **14% of queries** actually require the most powerful model | LMSYS RouteLLM |
| Premium models cost **10–30x more** per token than fast models in the same family | Provider pricing pages |
| Enterprise GenAI spending hit **$37B in 2025** — up 3.2x in one year | Menlo Ventures |
| **30–50%** of AI cloud spend evaporates into idle or overprovisioned resources | MILL5 |
| Only **51% of organizations** can even measure their AI ROI | MILL5 |

### The Energy Story

| Model tier | Energy per Query | Relative |
|-----------|-----------------|----------|
| Small/fast model | ~0.22 Wh | 1x |
| Premium reasoning model | ~39.2 Wh | **180x** |

> Every unnecessary premium model call wastes money, electricity, and GPU cycles.
> ModelGate eliminates them automatically.

---

## SLIDE 6 — Research Backs It Up

Smart model routing isn't just our idea — it's validated by top AI research labs:

| Research | Finding |
|----------|---------|
| **FrugalGPT** (Stanford, 2023) | Up to **98% cost reduction** while matching GPT-4 quality by routing through cheaper models first |
| **RouteLLM** (LMSYS, ICLR 2025) | **>85% cost reduction** at 95% of GPT-4 performance |
| RouteLLM matrix factorization router | Only **14% of calls** need the large model |

**The research is clear. The math is simple. The problem is implementation.**

Nobody builds this because it takes weeks to implement well.
ModelGate is the implementation, pre-built and ready to deploy.

---

## SLIDE 7 — ModelGate in Numbers (Our Results)

> **[INSERT LIVE DEMO NUMBERS HERE]**
> Cost per request: before vs. after
> Average latency: before vs. after
> % of requests routed to simple tier
> % of requests routed to medium tier
> % of requests routed to complex tier
> Total cost savings across X requests
> % savings vs. always-premium baseline

*These numbers will come from live system runs during the hackathon.*

---

## SLIDE 8 — How It Works

### Two phases. Fully automated.

**Phase 1 — Onboarding (30 seconds)**

Upload your contract → ModelGate reads it with an LLM → generates a routing profile:
- What data regions are allowed
- Which providers are contractually permitted
- What latency and cost targets apply
- What kind of use case this is

**Phase 2 — Runtime (50ms overhead)**

Every request → `classify prompt` → `filter policy` → `score models` → `call best model` → return answer

```
Simple query   → GPT 5.4 nano / Haiku 4.5 / Gemini 3.1 Flash Lite   (fast, cheap)   ✓
Medium query   → GPT 5.4 mini / Sonnet 4.6 / Grok 4.1 Fast           (balanced)      ✓
Complex query  → GPT 5.4 / Opus 4.6 / Gemini 3.1 Pro / Grok 4.20    (full power)    ✓
```

**No manual configuration. No model expertise required. No code changes beyond one URL.**

---

## SLIDE 9 — The Classifier: Arch-Router-1.5B

### A 1.5B parameter model built specifically for routing

We use `katanemo/Arch-Router-1.5B`, a specialized small model trained to classify prompts by complexity — not a generic LLM we're hacking for the purpose.

- Runs locally on GPU
- ~50ms classification latency
- Understands nuanced prompt complexity far better than keyword matching
- Falls back to a keyword/heuristic classifier if GPU is unavailable

**It's the right tool for the job.**

---

## SLIDE 10 — Policy Enforcement Is Automatic

### Contract constraints become hard routing rules

| Your Contract Says | ModelGate Does |
|--------------------|----------------|
| "All data must stay in the EU" | EU-region filter applied before any model is considered |
| "No China-based providers" | DeepSeek blocked at the policy layer — never receives a request |
| "Approved vendors: Anthropic and OpenAI only" | Every other provider eliminated before scoring |
| "P95 response time under 1 second" | Latency target factored into scoring, slow models deprioritized |
| "Cost optimization is a priority" | Scoring weighted toward lower-cost models |

**There's no human step between the contract and the enforcement.**

---

## SLIDE 11 — The Model Catalog

| Model | Provider | Tier | Relative Cost |
|-------|----------|------|---------------|
| GPT 5.4 nano | OpenAI | Simple | $ |
| Gemini 3.1 Flash Lite | Google | Simple | $ |
| Claude Haiku 4.5 | Anthropic | Simple | $$ |
| GPT 5.4 mini | OpenAI | Medium | $$ |
| Grok 4.1 Fast | xAI | Medium | $$ |
| Claude Sonnet 4.6 | Anthropic | Medium | $$$ |
| MiniMax M2.5 | MiniMax | Medium | $$ |
| GPT 5.4 | OpenAI | Complex | $$$$ |
| Claude Opus 4.6 | Anthropic | Complex | $$$$ |
| Gemini 3.1 Pro | Google | Complex | $$$$ |
| Grok 4.20 | xAI | Complex | $$$$ |
| MiniMax M2.7 | MiniMax | Complex | $$$ |

### What this means in practice

A customer support system with 65% simple, 30% medium, 5% complex queries:
- **Without ModelGate:** 100% of requests go to the premium-tier model
- **With ModelGate:** 65% go to cheap/fast, 30% to mid, only 5% to premium
- **Savings: 60–98%** depending on the cost gap between your tiers — automatically

---

## SLIDE 12 — Getting Started Is Genuinely Effortless

### Option A — You deploy ModelGate in your environment (Docker)
```bash
docker compose up
```
Point your app at the new URL. Done.

### Option B — We deploy and manage it for you
You give us your contract. We configure your profile. We hand you an endpoint URL.
You change one line of code.

### That's the entire onboarding story.

**No retraining your team on new models.**
**No evaluating 200 providers.**
**No building custom routing logic.**
**No compliance review of which providers are allowed.**

We read your contract. We build your profile. You ship.

---

## SLIDE 13 — The Dashboard

### Full visibility — no black box

Every routing decision is logged and explained:

- **Why** a model was chosen for each request
- **What** was eliminated and why (region, provider block, disabled model)
- **How much** each request cost
- **How much** you saved vs. always-premium
- **Latency** per model, per tier, over time

The dashboard shows the savings banner in real time:
> "Without ModelGate: $X → With ModelGate: $Y → **Saved: Z%**"

**If you want to override a routing decision, you can. The system is transparent, not opaque.**

---

## SLIDE 14 — Demo: Watch It Work

**Step 1** — Upload a customer contract
> Contract is read by the LLM extractor in real time.
> Extracted profile: EU-only, DeepSeek blocked, 1000ms latency target, high privacy.

**Step 2** — Copy the generated endpoint URL
> One URL. Drop-in for any OpenAI client.

**Step 3** — Send a simple prompt in the Playground
> "What is your return policy?"
> → Routes to: `GPT 5.4 nano` | ~300ms | pennies

**Step 4** — Send a complex prompt in the Playground
> "Analyze liability exposure across multiple warranty claims..."
> → Routes to: `Claude Opus 4.6` | ~1–2s | fraction of a cent

**Step 5** — View the dashboard
> Model distribution chart. Cost savings. Live routing explanations.
> Same endpoint. Different models. Automatic. Every time.

---

## SLIDE 15 — Who Should Use ModelGate

### Anyone running AI in production who hasn't optimized their model selection

- **Enterprises** deploying AI for different customers with different contracts
- **Product teams** using a single LLM for everything because it's easier
- **AI solutions engineers** who spend hours translating contracts into configs
- **Platform teams** with no visibility into what their AI is actually costing them

**If you're pointing any application at a single LLM, ModelGate will save you money immediately.**

---

## SLIDE 16 — Why Now

- AI spend is growing 3.2x year-over-year — the waste is getting bigger, not smaller
- The model landscape is changing every week — no team has time to keep up
- Compliance requirements (GDPR, data residency, provider restrictions) are becoming standard contract language
- The research proving smart routing works has been published — nobody has made it frictionless until now

> **The window to get ahead of this is open right now.**
> In two years, this will be table stakes. Today, it's a competitive advantage.

---

## SLIDE 17 — The 30-Second Pitch

> Everyone in AI is moving fast, and nobody has time to optimize their model selection.
> So they pick one premium model and use it for everything — and waste 60 to 98% of their AI budget.
>
> ModelGate fixes that with one line of code.
>
> You replace your OpenAI API URL with ours. We read your contract, build your routing policy, and intelligently route every request to the right model — fast queries to cheap models, complex queries to powerful ones, all within your contractual constraints.
>
> Your business saves money. Your users get faster responses. Data centers see less unnecessary load on GPU clusters. The planet uses less energy.
>
> It's the lowest-friction AI optimization that exists.
>
> We call it **ModelGate.**

---

## SLIDE 18 — What We Built (Concrete)

**Backend: Python / FastAPI**
- Contract extraction: LLM reads docs, outputs structured customer profile
- OpenAI-compatible proxy: `/{customer_id}/v1/chat/completions`
- Classifier: Arch-Router-1.5B (GPU) + heuristic fallback
- Router engine: policy filter → objective scoring → model selection
- Request logs with full routing metadata per request

**Frontend: Next.js / TypeScript / shadcn/ui**
- Dashboard: global stats, cost savings banner, model/provider charts, live feed
- 3-step customer onboarding wizard (upload → configure → review)
- Customer profile pages with per-customer metrics and editable constraints
- Playground: send prompts, see routing decisions in real time

**Infrastructure**
- Dockerized: `docker compose up` and it's running
- OpenRouter backend: unified API across OpenAI, Anthropic, Google, xAI, MiniMax, and more
- SQLite for profiles + logs (Postgres-ready)

---

## SLIDE 19 — Key Facts

| | |
|--|--|
| Onboarding time (contract → endpoint) | **< 30 seconds** |
| Code change required in your app | **1 line** |
| Prompt classification overhead | **~50ms** |
| Models available | **12 across 5 providers** |
| Routing constraints enforced | **Region, provider allow/block, latency, cost, admin toggle** |
| Cost savings vs always-premium | **60–98%** depending on request mix |
| API compatibility | **Full OpenAI drop-in** |
| Deployment | **Docker or managed** |

---

## SLIDE 20 — Closing

### ModelGate is the easiest AI infrastructure decision you'll make

**Faster to adopt** — one line of code, not a migration project
**Immediately impactful** — savings start on the first request
**Transparent** — every routing decision is logged and explained
**Compliant by default** — contract constraints are routing rules, not reminders
**Good for everyone** — business, users, data centers, the planet

> "Every unnecessary premium model call we prevent saves money, electricity, and GPU cycles.
> We prevent thousands of them, automatically, before you finish reading this sentence."

**Thank you.**

---

## Appendix A — Energy and Environmental Impact

| Model | Energy per Query | Relative Cost |
|-------|-----------------|---------------|
| Small model (LLaMA 1B) | ~0.22 Wh | 1x |
| Mid-tier model | ~2–5 Wh | ~10–23x |
| Premium reasoning model (o3) | ~39.2 Wh | **~180x** |

- Global data center power consumption: **415 TWh in 2024**
- Projected to exceed **1,000 TWh by 2026** (IEA)
- US data centers on track for **6% of total US electricity** by 2026

> When 86% of queries don't need the premium model (per LMSYS research),
> routing them away from it isn't just cost savings — it's a meaningful reduction in energy demand.

---

## Appendix B — Routing Decision Example

Request: `POST /acme-support/v1/chat/completions`
Prompt: *"What is your return policy?"*

1. **Classify** → `simple` (Arch-Router: FAQ-style, short, no reasoning required)
2. **Candidates** → `["gpt-5.4-nano", "claude-haiku-4-5"]` (ACME profile, simple tier)
3. **Filter**:
   - Both pass: EU region ✓, providers allowed ✓, models enabled ✓
4. **Score** (objective: `low_latency`, cost_sensitivity: `high`):
   - `gpt-5.4-nano`: latency ~300ms ≤ 1000ms ✓, lowest cost tier — highest score
   - `claude-haiku-4-5`: latency ~350ms ≤ 1000ms ✓, slightly higher cost — lower score
5. **Selected**: `gpt-5.4-nano`
6. **Response headers**:
   ```
   X-Model-Used: gpt-5.4-nano
   X-Classification: simple
   X-Latency-Ms: 298
   X-Cost: 0.0000012
   X-Routing-Decision: {"reason": "simple complexity; openai/gpt-5.4-nano selected; meets 1000ms latency target; objective: low_latency"}
   ```

---

## Appendix C — Contract Clause Extraction Examples

| Contract Language | Extracted Profile Field |
|-------------------|------------------------|
| "All data must remain within the European Economic Area" | `region: "EU-only"` |
| "Provider must not be based in China or subject to Chinese law" | `forbidden_providers: ["deepseek"]` |
| "Response time SLA: P95 under 1 second" | `latency_target_ms: 1000` |
| "Handles personally identifiable information" | `privacy_tier: "high"` |
| "Approved vendors: Anthropic and OpenAI only" | `allowed_providers: ["anthropic", "openai"]` |
| "Cost optimization is a primary business concern" | `objective: "low_cost"`, `cost_sensitivity: "high"` |

---

## Appendix D — Why OpenRouter

ModelGate uses OpenRouter as its inference backend — a unified API that provides access to 200+ models across OpenAI, Anthropic, Google, xAI, MiniMax, Meta, Mistral, and others through a single API key.

This means:
- ModelGate doesn't lock you into any single provider
- New models can be added to the catalog without changing the routing architecture
- If a provider goes down, fallback routing finds the next best compliant option automatically
