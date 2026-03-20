import json
import logging
from pathlib import Path

import httpx

from backend.config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL, EXTRACTION_MODEL, FALLBACK_PROFILES_DIR
from backend.models import CustomerProfile, slugify

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an AI deployment configuration specialist. Analyze the following customer contract and supporting documents. Extract a structured AI service profile.

<contract>
{contract_text}
</contract>

<custom_instructions>
{custom_instructions}
</custom_instructions>

Respond with ONLY valid JSON matching this exact schema:
{{
  "customer_name": "...",
  "use_case": "...",
  "objective": "low_latency" | "high_quality" | "low_cost",
  "constraints": {{
    "region": "EU-only" | "US-only" | "any",
    "privacy_tier": "low" | "standard" | "high",
    "forbidden_providers": [...],
    "allowed_providers": [...]
  }},
  "performance": {{
    "latency_target_ms": <number>,
    "cost_sensitivity": "low" | "medium" | "high"
  }},
  "routing_preferences": {{
    "simple": ["model1", "model2"],
    "medium": ["model1", "model2"],
    "complex": ["model1", "model2"]
  }},
  "warnings": ["any concerns or ambiguities found in the contract"]
}}

Available models: claude-haiku, gpt-4o-mini, claude-sonnet, gpt-4o, gemini-2.0-flash, gemini-2.5-pro, deepseek-v3

Rules:
- If the contract mentions GDPR, EU data residency, or European customers, set region to "EU-only"
- If the contract mentions US-only processing or US jurisdiction, set region to "US-only"
- If the contract mentions PII, PHI, or sensitive data, set privacy_tier to "high"
- If providers are explicitly forbidden (e.g., China-based), add them to forbidden_providers
- If only specific providers are approved, list them in allowed_providers
- Match routing_preferences to the objective and cost sensitivity
- For low_latency objective, prefer faster/cheaper models for simple queries
- For high_quality objective, prefer stronger models even for medium queries
- List warnings for any ambiguous or missing information
- IMPORTANT: Only output raw JSON, no markdown code blocks"""


async def extract_profile(
    customer_name: str, contract_text: str, custom_instructions: str = ""
) -> CustomerProfile:
    prompt = EXTRACTION_PROMPT.format(
        contract_text=contract_text,
        custom_instructions=custom_instructions or "None provided",
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://modelgate.app",
                    "X-Title": "ModelGate",
                },
                json={
                    "model": EXTRACTION_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 2000,
                },
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        profile_data = json.loads(content)
        customer_id = slugify(customer_name)

        return CustomerProfile(
            customer_id=customer_id,
            customer_name=profile_data.get("customer_name", customer_name),
            use_case=profile_data.get("use_case", "general"),
            objective=profile_data.get("objective", "low_cost"),
            constraints=profile_data.get("constraints", {}),
            performance=profile_data.get("performance", {}),
            routing_preferences=profile_data.get("routing_preferences", {
                "simple": ["gpt-4o-mini"],
                "medium": ["claude-sonnet"],
                "complex": ["gemini-2.5-pro"],
            }),
            warnings=profile_data.get("warnings", []),
        )

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        fallback = _load_fallback(customer_name)
        if fallback:
            logger.info(f"Using fallback profile for {customer_name}")
            return fallback
        raise


def _load_fallback(customer_name: str) -> CustomerProfile | None:
    slug = slugify(customer_name)
    fallback_path = FALLBACK_PROFILES_DIR / f"{slug}.json"
    if fallback_path.exists():
        return CustomerProfile.model_validate_json(fallback_path.read_text())

    # Try matching by filename
    for f in FALLBACK_PROFILES_DIR.glob("*.json"):
        if slug in f.stem or f.stem in slug:
            return CustomerProfile.model_validate_json(f.read_text())

    return None
