from unsloth import FastLanguageModel, is_bfloat16_supported
import torch

max_seq_length = 512   # Shorter context to save VRAM
lora_rank = 32         # Reduced from 64 to save VRAM

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "katanemo/Arch-Router-1.5B",  # Arch Router (Qwen2.5-1.5B-Instruct based)
    max_seq_length = max_seq_length,
    load_in_4bit = True,
    fast_inference = True,  # Enable vLLM for fast generation during GRPO
    max_lora_rank = lora_rank,
    gpu_memory_utilization = 0.6,  # Conservative for 8GB VRAM
)

model = FastLanguageModel.get_peft_model(
    model,
    r = lora_rank,
    target_modules = [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha = lora_rank,
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

import re
import json
from datasets import Dataset

# ── Route policies (must match backend/services/classifier.py) ──
ROUTE_POLICIES = [
    {
        "name": "simple",
        "description": "Simple factual questions, greetings, basic lookups, yes/no answers, FAQ-style queries, single-step tasks, status checks, straightforward requests",
    },
    {
        "name": "medium",
        "description": "Multi-step reasoning, summarization of moderate-length text, data extraction, moderate analysis, comparison tasks, troubleshooting, explanations requiring some depth",
    },
    {
        "name": "complex",
        "description": "Complex multi-document reasoning, deep analysis, legal or financial interpretation, creative writing, code generation, multi-constraint problem solving, liability assessment, comprehensive evaluation",
    },
]

# ── System prompt for GRPO training ──
# This teaches the model to reason before routing (chain-of-thought)
SYSTEM_PROMPT = f"""You are a routing assistant. Given the route policies and user message, select the best matching route.

<route_policies>
{json.dumps(ROUTE_POLICIES)}
</route_policies>

Respond in the following format:
<reasoning>
...analyze the query complexity, considering factors like: number of tasks requested, depth of analysis needed, domain specificity, and whether it requires multi-step reasoning...
</reasoning>
<answer>
{{"route": "route_name"}}
</answer>
"""

def extract_xml_answer(text: str) -> str:
    """Extract the answer content from <answer> tags."""
    answer = text.split("<answer>")[-1]
    answer = answer.split("</answer>")[0]
    return answer.strip()

def extract_route_from_answer(text: str) -> str | None:
    """Extract the route name from a JSON answer string."""
    try:
        parsed = json.loads(text)
        return parsed.get("route")
    except (json.JSONDecodeError, TypeError):
        # Fallback: look for route names directly
        text_lower = text.lower() if text else ""
        for tier in ("simple", "medium", "complex"):
            if tier in text_lower:
                return tier
    return None

# ── Load training data ──
# If running in Colab, upload grpo_training_data.json first
# or clone the repo and point to the right path
import os
DATA_PATHS = [
    "scripts/grpo_training_data.json",         # From repo root
    "grpo_training_data.json",                  # If uploaded directly
    "/content/grpo_training_data.json",         # Colab upload
]
data_path = None
for p in DATA_PATHS:
    if os.path.exists(p):
        data_path = p
        break

if data_path is None:
    raise FileNotFoundError(
        "Upload grpo_training_data.json to Colab or ensure it's in the scripts/ directory."
    )

with open(data_path) as f:
    raw_data = json.load(f)

print(f"Loaded {len(raw_data)} training examples from {data_path}")

# Format for GRPO: each example needs 'prompt' (list of messages) and 'answer' (ground truth)
formatted = []
for item in raw_data:
    formatted.append({
        "prompt": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": item["prompt"]},
        ],
        "answer": item["expected_route"],
        "domain": item.get("domain", "unknown"),
    })

dataset = Dataset.from_list(formatted)

# Show distribution
from collections import Counter
route_counts = Counter(item["expected_route"] for item in raw_data)
domain_counts = Counter(item.get("domain", "unknown") for item in raw_data)
print(f"Route distribution: {dict(route_counts)}")
print(f"Domain distribution: {dict(domain_counts)}")
print(f"\nSample prompt (first message):")
print(f"  System: {SYSTEM_PROMPT[:100]}...")
print(f"  User: {raw_data[0]['prompt']}")
print(f"  Expected: {raw_data[0]['expected_route']}")

# ── Reward functions for route classification ──

def correctness_reward_func(prompts, completions, answer, **kwargs) -> list[float]:
    """Highest reward: does the predicted route match the expected route?"""
    responses = [completion[0]["content"] for completion in completions]
    q = prompts[0][-1]["content"]
    extracted_answers = [extract_xml_answer(r) for r in responses]
    extracted_routes = [extract_route_from_answer(a) for a in extracted_answers]
    print("-" * 40)
    print(f"Question: {q[:80]}")
    print(f"Expected: {answer[0]}")
    print(f"Response: {responses[0][:150]}")
    print(f"Extracted route: {extracted_routes[0]}")
    return [2.0 if r == a else 0.0 for r, a in zip(extracted_routes, answer)]

def valid_route_reward_func(completions, **kwargs) -> list[float]:
    """Reward if the extracted route is one of the valid tier names."""
    responses = [completion[0]["content"] for completion in completions]
    extracted_answers = [extract_xml_answer(r) for r in responses]
    extracted_routes = [extract_route_from_answer(a) for a in extracted_answers]
    return [0.5 if r in ("simple", "medium", "complex") else 0.0 for r in extracted_routes]

def json_format_reward_func(completions, **kwargs) -> list[float]:
    """Reward if the answer section contains valid JSON with a 'route' key."""
    responses = [completion[0]["content"] for completion in completions]
    rewards = []
    for r in responses:
        answer_text = extract_xml_answer(r)
        try:
            parsed = json.loads(answer_text)
            if "route" in parsed:
                rewards.append(0.5)
            else:
                rewards.append(0.1)
        except (json.JSONDecodeError, TypeError):
            rewards.append(0.0)
    return rewards

def strict_format_reward_func(completions, **kwargs) -> list[float]:
    """Reward for exact format: <reasoning>\n...\n</reasoning>\n<answer>\n...\n</answer>"""
    pattern = r"^<reasoning>\n.*?\n</reasoning>\n<answer>\n.*?\n</answer>\n$"
    responses = [completion[0]["content"] for completion in completions]
    matches = [re.match(pattern, r, re.DOTALL) for r in responses]
    return [0.5 if match else 0.0 for match in matches]

def soft_format_reward_func(completions, **kwargs) -> list[float]:
    """Reward for loosely matching the reasoning+answer format."""
    pattern = r"<reasoning>.*?</reasoning>\s*<answer>.*?</answer>"
    responses = [completion[0]["content"] for completion in completions]
    matches = [re.match(pattern, r, re.DOTALL) for r in responses]
    return [0.5 if match else 0.0 for match in matches]

def count_xml(text) -> float:
    count = 0.0
    if text.count("<reasoning>\n") == 1:
        count += 0.125
    if text.count("\n</reasoning>\n") == 1:
        count += 0.125
    if text.count("\n<answer>\n") == 1:
        count += 0.125
        count -= len(text.split("\n</answer>\n")[-1]) * 0.001
    if text.count("\n</answer>") == 1:
        count += 0.125
        count -= (len(text.split("\n</answer>")[-1]) - 1) * 0.001
    return count

def xmlcount_reward_func(completions, **kwargs) -> list[float]:
    contents = [completion[0]["content"] for completion in completions]
    return [count_xml(c) for c in contents]

print("Reward functions defined. Max possible reward per generation: 4.5")
print("  correctness: 2.0 | valid_route: 0.5 | json_format: 0.5 | strict_format: 0.5 | soft_format: 0.5 | xmlcount: ~0.5")

from trl import GRPOConfig, GRPOTrainer

training_args = GRPOConfig(
    use_vllm = True,
    learning_rate = 5e-6,
    adam_beta1 = 0.9,
    adam_beta2 = 0.99,
    weight_decay = 0.1,
    warmup_ratio = 0.1,
    lr_scheduler_type = "cosine",
    optim = "adamw_8bit",
    logging_steps = 1,
    per_device_train_batch_size = 1,
    gradient_accumulation_steps = 1,
    num_generations = 4,              # Reduced from 8 to fit 8GB VRAM
    max_prompt_length = 384,          # Trimmed to save memory
    max_completion_length = 128,      # Route answer is short, don't need 256
    max_steps = 150,                  # Fewer steps — just enough to show improvement
    save_steps = 150,
    max_grad_norm = 0.1,
    report_to = "none",
    output_dir = "outputs_modelgate",
)

trainer = GRPOTrainer(
    model = model,
    processing_class = tokenizer,
    reward_funcs = [
        xmlcount_reward_func,
        soft_format_reward_func,
        strict_format_reward_func,
        json_format_reward_func,
        valid_route_reward_func,
        correctness_reward_func,
    ],
    args = training_args,
    train_dataset = dataset,
)
trainer.train()

# Test prompts — one from each tier
test_prompts = [
    ("What is your return policy?", "simple"),
    ("Compare the settlement amounts for similar property damage claims in the Southeast region this quarter.", "medium"),
    ("Analyze the multi-party liability exposure across claims #8901, #8902, and #8903 from the warehouse incident. Consider the overlapping coverage, assess subrogation potential, and determine whether our current reserves adequately reflect the combined exposure.", "complex"),
]

model.save_lora("modelgate_grpo_lora")

from vllm import SamplingParams
sampling_params = SamplingParams(
    temperature = 0.8,
    top_p = 0.95,
    max_tokens = 256,
)

for prompt_text, expected in test_prompts:
    text = tokenizer.apply_chat_template([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt_text},
    ], tokenize=False, add_generation_prompt=True)

    output = model.fast_generate(
        [text],
        sampling_params=sampling_params,
        lora_request=model.load_lora("modelgate_grpo_lora"),
    )[0].outputs[0].text

    extracted = extract_xml_answer(output)
    route = extract_route_from_answer(extracted)
    status = "✓" if route == expected else "✗"
    print(f"{status} Expected: {expected:>7s} | Got: {str(route):>7s} | Prompt: {prompt_text[:60]}")
    print(f"  Full output: {output[:200]}")
    print()

# Save LoRA adapter
model.save_pretrained("modelgate_arch_router_lora")
tokenizer.save_pretrained("modelgate_arch_router_lora")
print("LoRA adapter saved to modelgate_arch_router_lora/")

# Merge to 16-bit for deployment (uncomment to use)
# model.save_pretrained_merged("modelgate_arch_router_16bit", tokenizer, save_method="merged_16bit")
# print("Merged 16-bit model saved to modelgate_arch_router_16bit/")

# Push to HuggingFace (uncomment and set your token)
# model.push_to_hub_merged("YOUR_USERNAME/modelgate-arch-router", tokenizer, save_method="merged_16bit", token="YOUR_HF_TOKEN")

# Save to GGUF Q8_0 (uncomment to use)
# model.save_pretrained_gguf("modelgate_arch_router_gguf", tokenizer)

# Save to GGUF Q4_K_M for smaller size (uncomment to use)
# model.save_pretrained_gguf("modelgate_arch_router_gguf", tokenizer, quantization_method="q4_k_m")

# Push GGUF to HuggingFace (uncomment to use)
# model.push_to_hub_gguf("YOUR_USERNAME/modelgate-arch-router-GGUF", tokenizer, token="YOUR_HF_TOKEN")
