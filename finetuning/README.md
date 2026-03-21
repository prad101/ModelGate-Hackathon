# ModelGate Arch-Router Fine-Tuning

GRPO (Group Relative Policy Optimization) fine-tuning of the Arch-Router-1.5B model for ModelGate's contract-aware query routing.

## Why Fine-Tune?

The stock `katanemo/Arch-Router-1.5B` model was trained for general-purpose intent routing. Our use case is specific: classify incoming queries as **simple**, **medium**, or **complex** across customer support, insurance claims, and device protection domains. The heuristic fallback classifier achieves ~85% accuracy but struggles with medium-tier insurance/claims queries that contain domain-specific terms.

GRPO teaches the model to **reason about query complexity** before classifying, which improves accuracy on ambiguous cases without requiring manually labeled preference data.

## Architecture

```
Base model:  Qwen/Qwen2.5-1.5B-Instruct
     |
     v  (Katanemo fine-tune for intent routing)
Arch-Router-1.5B  (katanemo/Arch-Router-1.5B)
     |
     v  (Our GRPO fine-tune for ModelGate complexity routing)
ModelGate-Router   <-- this is what we're training
```

## Files

| File | Description |
|------|-------------|
| `grpo_finetune_arch_router.ipynb` | Main training notebook — run this on Colab (T4 GPU) |
| `grpo_training_data.json` | 172 labeled prompts across 4 domains |
| `Qwen2.5_3B_GRPO.ipynb` | Original Unsloth reference notebook (unmodified, for reference) |

## Training Data

**172 examples** across 4 domains and 3 complexity tiers:

| Domain | Count |
|--------|-------|
| customer_support | 51 |
| insurance_claims | 46 |
| device_protection | 37 |
| general | 38 |

| Tier | Count | Description |
|------|-------|-------------|
| simple | 95 | FAQs, status checks, greetings, yes/no questions |
| medium | 51 | Multi-step troubleshooting, comparisons, summaries |
| complex | 26 | Multi-document analysis, legal/financial reasoning, comprehensive evaluations |

Data format (`grpo_training_data.json`):
```json
{
  "prompt": "What is your return policy?",
  "expected_route": "simple",
  "domain": "customer_support"
}
```

## How GRPO Training Works

Unlike supervised fine-tuning (SFT) where you provide input-output pairs, GRPO:

1. **Generates** 8 candidate completions per prompt using the current model
2. **Scores** each completion with reward functions
3. **Reinforces** completions that scored highest relative to the group

This teaches the model to discover effective reasoning patterns on its own.

### Reward Functions

| Function | Max Score | What It Rewards |
|----------|-----------|-----------------|
| `correctness_reward_func` | 2.0 | Predicted route matches ground truth |
| `valid_route_reward_func` | 0.5 | Output contains a valid route name |
| `json_format_reward_func` | 0.5 | Answer section is valid JSON with "route" key |
| `strict_format_reward_func` | 0.5 | Exact `<reasoning>\n...\n</reasoning>\n<answer>\n...\n</answer>` |
| `soft_format_reward_func` | 0.5 | Loosely matches reasoning + answer format |
| `xmlcount_reward_func` | ~0.5 | Counts individual XML tag presence |

Total possible reward per generation: **~4.5**

### Output Format

The model learns to produce:
```xml
<reasoning>
This is a simple factual question asking about return policy.
It's a basic FAQ-style query requiring a single lookup, no
multi-step reasoning or complex analysis needed.
</reasoning>
<answer>
{"route": "simple"}
</answer>
```

## How to Run

### Prerequisites

- Google Colab account (free tier works — needs T4 GPU)
- Or any machine with a GPU (7GB+ VRAM)

### Steps

1. Open `grpo_finetune_arch_router.ipynb` in Google Colab
2. Upload `grpo_training_data.json` to the Colab environment
3. Set runtime to **GPU** (T4 is fine)
4. **Run All**
5. Training takes ~30-60 minutes for 250 steps
6. Expect 0 reward for first ~100 steps — this is normal
7. Reward should start climbing around step 100-150
8. After training, run the test cell (Section 7) to verify accuracy
9. Save the LoRA adapter or merged model (Section 8)

### Key Training Parameters

```python
model_name = "katanemo/Arch-Router-1.5B"  # 1.5B params, Qwen2.5 architecture
load_in_4bit = True                        # ~7GB VRAM
lora_rank = 64                             # LoRA rank
max_seq_length = 1024                      # Max context length
max_steps = 250                            # Training steps (increase for better results)
num_generations = 8                        # GRPO samples per prompt
learning_rate = 5e-6                       # Conservative LR
max_prompt_length = 512                    # Our routing prompts are ~300-400 tokens
max_completion_length = 256                # Reasoning + JSON answer
```

## Integration with ModelGate Backend

After training, to deploy the fine-tuned model:

1. **Save the merged 16-bit model** (Section 8 of the notebook)

2. **Update `backend/services/classifier.py`**:
   - Point `model_name` to your saved model path
   - Update `_build_arch_prompt()` to include the `<reasoning>/<answer>` format instructions
   - Update `_arch_router_classify()` to parse `<answer>` tags:

```python
# In _arch_router_classify(), after decoding the response:
if "<answer>" in response:
    answer_text = response.split("<answer>")[-1].split("</answer>")[0].strip()
    try:
        parsed = json.loads(answer_text)
        route = parsed.get("route", "medium")
        if route in ("simple", "medium", "complex"):
            return route
    except json.JSONDecodeError:
        pass
```

3. **Benchmark** before and after:
```bash
python scripts/bench_router.py classify
```

## Route Policies

These are the three routing tiers the model classifies into (defined in `backend/services/classifier.py`):

```json
[
  {
    "name": "simple",
    "description": "Simple factual questions, greetings, basic lookups, yes/no answers, FAQ-style queries, single-step tasks, status checks, straightforward requests"
  },
  {
    "name": "medium",
    "description": "Multi-step reasoning, summarization of moderate-length text, data extraction, moderate analysis, comparison tasks, troubleshooting, explanations requiring some depth"
  },
  {
    "name": "complex",
    "description": "Complex multi-document reasoning, deep analysis, legal or financial interpretation, creative writing, code generation, multi-constraint problem solving, liability assessment, comprehensive evaluation"
  }
]
```

## References

- [Arch-Router-1.5B on HuggingFace](https://huggingface.co/katanemo/Arch-Router-1.5B) — base model
- [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) — foundation model
- [Unsloth](https://github.com/unslothai/unsloth) — training framework
- [Unsloth GRPO Blog](https://unsloth.ai/blog/r1-reasoning) — GRPO methodology and examples
- [TRL GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) — training library
