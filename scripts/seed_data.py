#!/usr/bin/env python3
"""Seed the ModelGate database with demo data."""

import sys
import json
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import init_db, save_customer, save_request_log
from backend.models import CustomerProfile, RequestLogEntry

FALLBACK_DIR = Path(__file__).parent.parent / "backend" / "data" / "fallback_profiles"


def seed_customers():
    for f in FALLBACK_DIR.glob("*.json"):
        profile = CustomerProfile.model_validate_json(f.read_text())
        save_customer(profile)
        print(f"  Created customer: {profile.customer_name} ({profile.customer_id})")


def seed_request_logs():
    acme_models = {
        "simple": [("gpt-4o-mini", "openai", 200, 400), ("claude-haiku", "anthropic", 250, 450)],
        "medium": [("claude-sonnet", "anthropic", 600, 1200), ("gpt-4o", "openai", 500, 1100)],
        "complex": [("claude-sonnet", "anthropic", 1200, 2500)],
    }

    acme_prompts = {
        "simple": [
            "What is your return policy?",
            "How do I track my order?",
            "What are your business hours?",
            "Can I change my shipping address?",
            "Where is my refund?",
            "Do you ship internationally?",
            "How do I reset my password?",
            "What payment methods do you accept?",
        ],
        "medium": [
            "I received a damaged item and need to process a return with a replacement",
            "Can you explain the warranty coverage for my electronics purchase from last month?",
            "I need help troubleshooting why my device isn't connecting to WiFi after the update",
            "Please summarize my recent order history and any pending returns",
        ],
        "complex": [
            "I have multiple ongoing warranty claims across three different product categories and need a comprehensive resolution strategy",
            "Analyze my account history and identify any patterns in the service issues I've reported over the past year",
        ],
    }

    globex_models = {
        "simple": [("gpt-4o-mini", "openai", 180, 350), ("claude-haiku", "anthropic", 200, 400)],
        "medium": [("claude-sonnet", "anthropic", 700, 1400), ("gpt-4o", "openai", 600, 1200)],
        "complex": [("gemini-2.5-pro", "google", 1800, 4500), ("claude-sonnet", "anthropic", 1500, 3000)],
    }

    globex_prompts = {
        "simple": [
            "What is the policy number for claim #4521?",
            "Show me the status of pending claims for region NE",
            "What is the deductible for plan type B?",
            "List all adjusters assigned to auto claims",
        ],
        "medium": [
            "Summarize the medical records and coverage analysis for claim #7823",
            "Compare the settlement amounts for similar property damage claims this quarter",
            "Extract the key liability factors from the accident report attached to claim #6104",
            "Review the subrogation potential for the batch of claims from the March flooding event",
        ],
        "complex": [
            "Analyze the multi-party liability exposure across claims #8901, #8902, and #8903 from the warehouse incident, considering overlapping coverage and potential subrogation",
            "Evaluate the fraud indicators across the last 50 auto claims from the Southeast region and recommend investigation priorities based on anomaly patterns",
            "Perform a comprehensive coverage analysis for the commercial property claim involving multiple structures, business interruption, and environmental liability",
        ],
    }

    cost_map = {
        "gpt-4o-mini": (0.00015, 0.0006),
        "claude-haiku": (0.0008, 0.004),
        "claude-sonnet": (0.003, 0.015),
        "gpt-4o": (0.0025, 0.01),
        "gemini-2.5-pro": (0.0025, 0.015),
    }

    now = datetime.now(timezone.utc)
    count = 0

    for customer_id, models, prompts in [
        ("acme-support", acme_models, acme_prompts),
        ("globex-claims", globex_models, globex_prompts),
    ]:
        for i in range(25):
            # Weight towards simple queries for ACME, more complex for Globex
            if customer_id == "acme-support":
                tier = random.choices(["simple", "medium", "complex"], weights=[65, 30, 5])[0]
            else:
                tier = random.choices(["simple", "medium", "complex"], weights=[30, 40, 30])[0]

            prompt = random.choice(prompts[tier])
            model_name, provider, lat_min, lat_max = random.choice(models[tier])
            latency = random.randint(lat_min, lat_max)

            input_tokens = len(prompt.split()) * 3 + random.randint(10, 50)
            output_tokens = random.randint(50, 400)
            costs = cost_map.get(model_name, (0.001, 0.005))
            cost = (input_tokens / 1000) * costs[0] + (output_tokens / 1000) * costs[1]

            timestamp = (now - timedelta(hours=random.randint(1, 48))).isoformat()

            entry = RequestLogEntry(
                customer_id=customer_id,
                timestamp=timestamp,
                prompt_preview=prompt[:150],
                classification=tier,
                selected_provider=provider,
                selected_model=model_name,
                reason=f"{tier} complexity; {provider}/{model_name} selected; objective met",
                latency_ms=latency,
                estimated_cost=round(cost, 6),
                tokens_used=input_tokens + output_tokens,
            )
            save_request_log(entry)
            count += 1

    print(f"  Created {count} request log entries")


if __name__ == "__main__":
    print("Seeding ModelGate database...")
    init_db()
    seed_customers()
    seed_request_logs()
    print("Done!")
