"""
Dynamic Exposure-Minimizing Routine Scheduler.
Optimizes placement of flexible household activities (school run, exercise, errands, window ventilation)
into the lowest-exposure feasible forecast windows.
"""

from dataclasses import dataclass


@dataclass
class FlexibleActivity:
    id: str
    name_en: str
    name_hi: str
    name_mr: str
    duration_hours: int
    feasible_start_hour: int  # 0 to 23
    feasible_end_hour: int  # 1 to 24 (inclusive upper bound for end time)
    default_hour: int  # User's unoptimized default start time
    activity_level: str  # "sedentary", "light", "moderate"
    is_outdoor: bool = True


@dataclass
class ScheduledSlot:
    activity_id: str
    name_en: str
    name_hi: str
    name_mr: str
    baseline_hour: int
    optimized_hour: int
    duration_hours: int
    baseline_avg_pm25: float
    optimized_avg_pm25: float
    pm25_reduction_ug_m3: float
    percentage_reduction: float
    rationale_en: str
    rationale_hi: str
    rationale_mr: str


def optimize_activity_schedule(
    activity: FlexibleActivity,
    hourly_pm25_forecast: list[float],  # 24 elements for hours 0..23
) -> ScheduledSlot:
    """
    Finds the contiguous time slot of length `duration_hours` within [feasible_start_hour, feasible_end_hour]
    that minimizes average PM2.5 exposure.
    Uses an exhaustive window sweep (sliding window / DP) with guaranteed optimal selection.
    """
    if len(hourly_pm25_forecast) < 24:
        raise ValueError("hourly_pm25_forecast must contain at least 24 hourly readings")

    duration = max(1, min(12, activity.duration_hours))
    earliest = max(0, min(23, activity.feasible_start_hour))
    latest = max(earliest + duration, min(24, activity.feasible_end_hour))

    # Evaluate baseline default slot
    base_start = max(0, min(24 - duration, activity.default_hour))
    base_slice = hourly_pm25_forecast[base_start : base_start + duration]
    base_avg = sum(base_slice) / len(base_slice) if base_slice else 0.0

    # Search feasible space for minimum average PM2.5
    best_start = base_start
    best_avg = base_avg

    for start_h in range(earliest, latest - duration + 1):
        window = hourly_pm25_forecast[start_h : start_h + duration]
        win_avg = sum(window) / len(window)
        if win_avg < best_avg:
            best_avg = win_avg
            best_start = start_h

    reduction = max(0.0, base_avg - best_avg)
    pct = round((reduction / base_avg * 100.0), 1) if base_avg > 0 else 0.0

    # Rationale construction
    time_str_base = f"{base_start:02d}:00"
    time_str_opt = f"{best_start:02d}:00"

    if best_start == base_start or reduction < 1.0:
        rationale_en = (
            f"Current timing ({time_str_base}) is already within the cleanest available window."
        )
        rationale_hi = f"वर्तमान समय ({time_str_base}) पहले से ही सबसे स्वच्छ उपलब्ध समय सीमा में है।"
        rationale_mr = f"सध्याची वेळ ({time_str_base}) आधीच उपलब्ध असलेल्या स्वच्छ वेळेत आहे."
    else:
        rationale_en = (
            f"Moving from {time_str_base} to {time_str_opt} avoids peak winter inversion, "
            f"reducing exposure by {round(reduction, 1)} µg/m³ ({pct}%)."
        )
        rationale_hi = (
            f"{time_str_base} से {time_str_opt} पर स्थानांतरित करने से शीतकालीन प्रदूषण के चरम स्तर से बचा जा सकता है, "
            f"जिससे जोखिम {round(reduction, 1)} µg/m³ ({pct}%) कम होता है।"
        )
        rationale_mr = (
            f"{time_str_base} वरून {time_str_opt} वर हलवल्याने थंडीतील प्रदूषणाचा उच्चांक टाळता येतो, "
            f"ज्यामुळे संपर्क {round(reduction, 1)} µg/m³ ({pct}%) कमी होतो."
        )

    return ScheduledSlot(
        activity_id=activity.id,
        name_en=activity.name_en,
        name_hi=activity.name_hi,
        name_mr=activity.name_mr,
        baseline_hour=base_start,
        optimized_hour=best_start,
        duration_hours=duration,
        baseline_avg_pm25=round(base_avg, 1),
        optimized_avg_pm25=round(best_avg, 1),
        pm25_reduction_ug_m3=round(reduction, 1),
        percentage_reduction=pct,
        rationale_en=rationale_en,
        rationale_hi=rationale_hi,
        rationale_mr=rationale_mr,
    )


def optimize_household_day_plan(
    activities: list[FlexibleActivity], hourly_pm25_forecast: list[float]
) -> list[ScheduledSlot]:
    """
    Optimizes a suite of household flexible activities across the 24-hour forecast.
    """
    return [optimize_activity_schedule(act, hourly_pm25_forecast) for act in activities]
