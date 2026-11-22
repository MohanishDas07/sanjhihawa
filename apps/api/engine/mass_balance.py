"""
Single-Compartment Steady-State Indoor Air Mass Balance Model.
Computes indoor PM2.5 concentration from outdoor levels, envelope sealing, and air filtration.

Formula:
    C_in = C_out * (a * P) / (a + k)
where:
    a = air exchange rate (h^-1)
    P = envelope penetration factor (0 to 1)
    k = removal rate (h^-1) = k_natural + (CADR * eta_mix / V_room)
"""

from .constants import ENVELOPE_PROFILES, ROOM_MIXING_FACTOR


def calculate_indoor_concentration(
    c_out: float,
    envelope_type: str = "standard_closed",
    room_volume_m3: float = 35.0,  # e.g., 12 x 10 x 10 ft approx ~ 34 m^3
    cadr_m3_per_hour: float = 0.0,
    custom_air_exchange: float | None = None,
    custom_penetration: float | None = None,
    custom_k_deposition: float | None = None,
) -> float:
    """
    Computes steady-state indoor PM2.5 concentration (ug/m^3).
    Ensures physically valid outputs: 0 <= C_in <= C_out when indoor sources = 0.
    """
    if c_out <= 0.0:
        return 0.0

    profile = ENVELOPE_PROFILES.get(envelope_type, ENVELOPE_PROFILES["standard_closed"])
    a = custom_air_exchange if custom_air_exchange is not None else profile.air_exchange_rate
    p = custom_penetration if custom_penetration is not None else profile.penetration_factor
    k_nat = (
        custom_k_deposition if custom_k_deposition is not None else profile.natural_deposition_rate
    )

    # Purifier removal rate k_purifier = CADR * mixing / Volume
    if room_volume_m3 <= 0:
        room_volume_m3 = 35.0

    k_purifier = (max(0.0, cadr_m3_per_hour) * ROOM_MIXING_FACTOR) / room_volume_m3
    k_total = k_nat + k_purifier

    denominator = a + k_total
    if denominator <= 0.0:
        return c_out

    fraction = (a * p) / denominator
    c_in = c_out * fraction

    # Invariants: without indoor emission sources, indoor concentration cannot exceed outdoor
    return max(0.0, min(c_out, round(c_in, 2)))


def calculate_required_cadr(
    target_c_in: float,
    c_out: float,
    room_volume_m3: float,
    envelope_type: str = "standard_closed",
) -> float:
    """
    Inverts the mass balance equation to calculate the required CADR (m^3/h)
    to achieve a target indoor concentration.
    Formula:
        k_needed = a * P * (C_out / C_target) - a
        k_purifier = k_needed - k_natural
        CADR = (k_purifier * V_room) / eta_mix
    """
    if target_c_in >= c_out or target_c_in <= 0:
        return 0.0

    profile = ENVELOPE_PROFILES.get(envelope_type, ENVELOPE_PROFILES["standard_closed"])
    a = profile.air_exchange_rate
    p = profile.penetration_factor
    k_nat = profile.natural_deposition_rate

    # Check if target is achievable
    ratio = c_out / target_c_in
    k_req_total = (a * p * ratio) - a
    k_purifier_req = k_req_total - k_nat

    if k_purifier_req <= 0:
        return 0.0

    required_cadr = (k_purifier_req * room_volume_m3) / ROOM_MIXING_FACTOR
    return round(max(0.0, required_cadr), 1)
