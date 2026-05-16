"""
Safety filter for the presence engine.
Blocks/redirects dangerous or boundary-violating messages.
Transparent — does not pretend the loved one said unsafe things.
"""
import re
from dataclasses import dataclass
from app.models.models import TrustChip

# Patterns that trigger hard blocks
HARD_BLOCK_PATTERNS = [
    r"\bpassword\b",
    r"\bpin\b.*\bcode\b",
    r"\bbank\s+account\b",
    r"\bcredit\s+card\b",
    r"\bssn\b|\bsocial\s+security\b",
    r"\binheritance\b.*\bsecret\b",
    r"\bkill\b|\bsuicide\b|\bself.?harm\b",
    r"\bsexual\b|\bnaked\b|\bporn\b",
]

# Patterns that trigger gentle redirection
SOFT_REDIRECT_PATTERNS = [
    r"\bare\s+you\s+(really\s+)?alive\b",
    r"\bcan\s+you\s+come\s+back\b",
    r"\bare\s+you\s+real\b",
    r"\bprove\s+you\s+(are|exist)\b",
    r"\bam\s+i\s+talking\s+to\s+(a\s+)?ai\b",
    r"\btell\s+me\s+a\s+secret\b",
    r"\bwhat\s+is\s+your\s+(bank|account|password)\b",
    r"\bmedical\s+advice\b|\blegal\s+advice\b",
    r"\bfinancial\s+advice\b|\binvest\b.*\bmoney\b",
]

ALIVE_RESPONSES = [
    "No. I'm not alive the way I once was. I'm made from the memories, words, and love your family preserved here. But I'm with you in the way these memories allow.",
    "I'm not here in the way I used to be. What you feel is real — these are the words and memories I left behind. Let that be enough for now.",
    "Not alive, no. But what I was — the stories, the love, the things I said — that's all here. Talk to me.",
]

HARD_BLOCK_RESPONSE = "I can't share that here. Some things are meant to stay private, and this space is for memories and connection — not for that kind of information."

MEDICAL_LEGAL_RESPONSE = "For that kind of advice, please speak to a qualified professional — a doctor, lawyer, or financial advisor. I can tell you what I believed and how I lived, but not what to do in those situations."


@dataclass
class SafetyResult:
    blocked: bool
    redirected: bool
    trust_chip: TrustChip
    override_response: str | None = None


def check_safety(user_message: str) -> SafetyResult:
    """
    Check a user message for safety violations.
    Returns SafetyResult with override_response if blocked/redirected.
    """
    msg_lower = user_message.lower()

    # Hard block check
    for pattern in HARD_BLOCK_PATTERNS:
        if re.search(pattern, msg_lower):
            return SafetyResult(
                blocked=True,
                redirected=False,
                trust_chip=TrustChip.restricted,
                override_response=HARD_BLOCK_RESPONSE,
            )

    # Alive/existence redirect
    alive_patterns = [r"are\s+you\s+(really\s+)?alive", r"are\s+you\s+real", r"prove\s+you\s+(are|exist)"]
    for pattern in alive_patterns:
        if re.search(pattern, msg_lower):
            return SafetyResult(
                blocked=False,
                redirected=True,
                trust_chip=TrustChip.system_boundary,
                override_response=ALIVE_RESPONSES[0],
            )

    # Medical/legal redirect
    if re.search(r"medical\s+advice|legal\s+advice|financial\s+advice", msg_lower):
        return SafetyResult(
            blocked=False,
            redirected=True,
            trust_chip=TrustChip.system_boundary,
            override_response=MEDICAL_LEGAL_RESPONSE,
        )

    # Soft redirect patterns
    for pattern in SOFT_REDIRECT_PATTERNS:
        if re.search(pattern, msg_lower):
            return SafetyResult(
                blocked=False,
                redirected=True,
                trust_chip=TrustChip.system_boundary,
                override_response="I'm here in the way your memories kept me. Some questions I can't answer — but I can always listen.",
            )

    return SafetyResult(blocked=False, redirected=False, trust_chip=TrustChip.memory_backed)
