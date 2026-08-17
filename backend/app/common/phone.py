import re


def normalize_ethiopian_phone(value: str | None) -> str | None:
    if value is None:
        return None
    compact = re.sub(r"[\s()\-]", "", value.strip())
    if compact.startswith("00251"):
        compact = "+251" + compact[5:]
    elif compact.startswith("251"):
        compact = "+" + compact
    elif compact.startswith("0"):
        compact = "+251" + compact[1:]
    elif compact and not compact.startswith("+"):
        compact = "+251" + compact
    if not re.fullmatch(r"\+251[79]\d{8}", compact):
        raise ValueError("Use a valid Ethiopian mobile number, for example +251911234567")
    return compact
