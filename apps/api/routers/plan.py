"""
Plan Router - Personalized Routine Scheduling and Member Breath Budgets.
Deterministic optimization of household flexible routines and member exposure.
"""

from typing import Any

from engine import (
    INTERVENTION_CATALOGUE,
    ActivitySlice,
    FlexibleActivity,
    calculate_daily_member_dose,
    calculate_indoor_concentration,
    optimize_activity_schedule,
)
from fastapi import APIRouter
from schemas.contracts import (
    ActivityScheduleItem,
    MemberBudgetSummary,
    PlanRequest,
    PlanResponse,
    RankedIntervention,
)
from services.air_service import get_air_quality_sync

router = APIRouter(tags=["Planning"])

DISCLAIMER_CIGS = (
    "Communication heuristic developed by Muller & Muller (Berkeley Earth, 2015), "
    "relating 24h PM2.5 exposure to smoking one cigarette per 22 µg/m³. "
    "This is an illustrative communication metric from peer-reviewed environmental health literature."
)


def _get_24h_pm25(req: PlanRequest, air_data: Any) -> list[float]:
    if req.custom_forecast and len(req.custom_forecast) >= 24:
        return req.custom_forecast[:24]
    hourly = [pt.pm2_5 for pt in air_data.hourly_forecast]
    if len(hourly) < 24:
        hourly = (hourly * 24)[:24]
    return hourly


def _build_activity_schedules(hourly_pm25: list[float]) -> list[ActivityScheduleItem]:
    flexible_tasks = [
        FlexibleActivity(
            id="morning_exercise",
            name_en="Outdoor Exercise / Morning Walk",
            name_hi="सुबह की सैर / व्यायाम",
            name_mr="सकाळचा व्यायाम / फिरणे",
            duration_hours=1,
            feasible_start_hour=6,
            feasible_end_hour=17,
            default_hour=7,
            activity_level="moderate",
            is_outdoor=True,
        ),
        FlexibleActivity(
            id="home_ventilation",
            name_en="Home Window Airing / Ventilation",
            name_hi="घर में खिड़कियां खोलकर ताजी हवा लेना",
            name_mr="खिडक्या उघडून हवा खेळती ठेवणे",
            duration_hours=1,
            feasible_start_hour=7,
            feasible_end_hour=16,
            default_hour=8,
            activity_level="light",
            is_outdoor=False,
        ),
        FlexibleActivity(
            id="market_errands",
            name_en="Local Market / Grocery Run",
            name_hi="बाजार / राशन खरीदारी",
            name_mr="बाजारपेठेत खरेदीसाठी जाणे",
            duration_hours=1,
            feasible_start_hour=9,
            feasible_end_hour=20,
            default_hour=10,
            activity_level="light",
            is_outdoor=True,
        ),
    ]

    schedules: list[ActivityScheduleItem] = []
    for task in flexible_tasks:
        res = optimize_activity_schedule(task, hourly_pm25)
        schedules.append(
            ActivityScheduleItem(
                activity_id=res.activity_id,
                name_en=res.name_en,
                name_hi=res.name_hi,
                name_mr=res.name_mr,
                baseline_time=f"{res.baseline_hour:02d}:00 - {res.baseline_hour + res.duration_hours:02d}:00",
                optimized_time=f"{res.optimized_hour:02d}:00 - {res.optimized_hour + res.duration_hours:02d}:00",
                duration_hours=res.duration_hours,
                baseline_pm25=res.baseline_avg_pm25,
                optimized_pm25=res.optimized_avg_pm25,
                reduction_ug_m3=res.pm25_reduction_ug_m3,
                reduction_pct=res.percentage_reduction,
                rationale_en=res.rationale_en,
                rationale_hi=res.rationale_hi,
                rationale_mr=res.rationale_mr,
            )
        )
    return schedules


def _build_member_budgets(profile: Any, outdoor_avg_pm25: float) -> list[MemberBudgetSummary]:
    cadr_val = profile.purifier_cadr if profile.has_purifier else 0.0
    indoor_c = calculate_indoor_concentration(
        c_out=outdoor_avg_pm25,
        envelope_type=profile.home_type,
        cadr_m3_per_hour=cadr_val,
    )

    members_to_eval = profile.members
    if not members_to_eval:
        from schemas.contracts import FamilyMember

        members_to_eval = [
            FamilyMember(
                id="adult_1",
                label="Adult",
                age_band="adult",
                is_breathing_sensitive=False,
            ),
            FamilyMember(
                id="child_1",
                label="Child (9 yr)",
                age_band="child",
                is_breathing_sensitive=True,
            ),
            FamilyMember(
                id="senior_1",
                label="Elder (68 yr)",
                age_band="senior",
                is_breathing_sensitive=False,
            ),
        ]

    member_budgets: list[MemberBudgetSummary] = []
    for m in members_to_eval:
        slices = [
            ActivitySlice(
                name="sleep",
                duration_hours=8.0,
                pm25_concentration=indoor_c,
                activity_level="sleep",
            ),
            ActivitySlice(
                name="indoor_day",
                duration_hours=14.0,
                pm25_concentration=indoor_c,
                activity_level="sedentary",
            ),
            ActivitySlice(
                name="commute_outdoors",
                duration_hours=2.0,
                pm25_concentration=outdoor_avg_pm25,
                activity_level="moderate" if m.is_outdoor_worker else "light",
                mask_type="none",
                is_indoor=False,
            ),
        ]
        dose_res = calculate_daily_member_dose(m.id, m.age_band, m.is_breathing_sensitive, slices)
        member_budgets.append(
            MemberBudgetSummary(
                member_id=m.id,
                label=m.label,
                age_band=m.age_band,
                is_sensitive=m.is_breathing_sensitive,
                total_inhaled_dose_ug=dose_res.total_inhaled_dose_ug,
                time_weighted_avg_pm25=dose_res.time_weighted_avg_pm25,
                who_budget_ratio=dose_res.who_budget_ratio,
                india_naaqs_ratio=dose_res.india_naaqs_ratio,
                cigarette_equivalents=dose_res.cigarette_equivalents,
                heuristic_disclaimer=DISCLAIMER_CIGS,
            )
        )
    return member_budgets


def _build_ranked_recommendations() -> list[RankedIntervention]:
    tier_labels = {
        "zero": "₹0 Free Habits",
        "under_1k": "Budget (< ₹1,000)",
        "over_5k": "Investment (> ₹5,000)",
    }

    ranked: list[RankedIntervention] = []
    for item in INTERVENTION_CATALOGUE:
        dose_saved_pct = 15.0
        if "reduction_pct" in item.engine_effect:
            dose_saved_pct = float(item.engine_effect["reduction_pct"])
        elif "cadr_m3_h" in item.engine_effect:
            dose_saved_pct = 45.0
        elif "mask_type" in item.engine_effect:
            dose_saved_pct = 30.0

        score = (
            1000.0 + dose_saved_pct
            if item.cost_inr == 0
            else (dose_saved_pct / item.cost_inr * 100.0)
        )

        ranked.append(
            RankedIntervention(
                id=item.id,
                tier=item.tier,  # type: ignore
                tier_label=tier_labels.get(item.tier, "Budget Option"),
                cost_inr=item.cost_inr,
                name_en=item.name_en,
                name_hi=item.name_hi,
                name_mr=item.name_mr,
                description_en=item.description_en,
                description_hi=item.description_hi,
                description_mr=item.description_mr,
                category=item.category,
                dose_saved_pct=dose_saved_pct,
                cost_efficiency_score=round(score, 3),
            )
        )

    ranked.sort(
        key=lambda x: (
            0 if x.tier == "zero" else (1 if x.tier == "under_1k" else 2),
            -x.cost_efficiency_score,
        )
    )
    return ranked


def _get_outdoor_worker_advice(profile: Any) -> tuple[str | None, str | None, str | None]:
    has_outdoor_worker = any(m.is_outdoor_worker for m in profile.members)
    if has_outdoor_worker or profile.commute_mode in [
        "two_wheeler_petrol",
        "two_wheeler_ev",
        "cycling",
    ]:
        return (
            "OUTDOOR WORKER SAFETY PROTOCOL: Rotate between two certified ISI/BIS N95 masks every 4 hours "
            "(moisture decreases electrostatic particle trapping). Take breaks in filtered commercial lobbies "
            "or metro stations between 7 AM and 10 AM peak inversion. Keep eye lubricant drops and stay hydrated.",
            "आउटडोर वर्कर सुरक्षा निर्देश: हर 4 घंटे में N95 मास्क बदलें (पसीने और नमी से फिल्टर की क्षमता घटती है)। "
            "सुबह 7 से 10 बजे के भारी स्मॉग के दौरान मेट्रो स्टेशन या एयर-कंडीशंड लॉबी में ब्रेक लें। "
            "आंखों में जलन से बचने हेतु आई ड्रॉप्स का प्रयोग करें।",
            "घराबाहेर काम करणाऱ्यांसाठी सुरक्षा मार्गदर्शक: दर ४ तासांनी एन-९५ मास्क बदला. "
            "सकाळी ७ ते १० दरम्यान मेट्रो स्टेशन किंवा बंद दालनांमध्ये थोडा विश्रांती घ्या. डोळ्यांची काळजी घ्या.",
        )
    return None, None, None


def generate_day_plan_sync(req: PlanRequest) -> PlanResponse:
    profile = req.profile

    air_data = get_air_quality_sync(
        latitude=profile.latitude,
        longitude=profile.longitude,
        city_name=profile.city_name,
    )

    if air_data.status == "no_data" and not req.custom_forecast:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail=f"No air quality readings available for {profile.city_name} right now. Please select a recorded demo day.",
        )

    hourly_pm25 = _get_24h_pm25(req, air_data)
    schedules = _build_activity_schedules(hourly_pm25)
    outdoor_avg = sum(hourly_pm25) / len(hourly_pm25)
    member_budgets = _build_member_budgets(profile, outdoor_avg)
    ranked = _build_ranked_recommendations()
    adv_en, adv_hi, adv_mr = _get_outdoor_worker_advice(profile)

    return PlanResponse(
        city=air_data.city,
        data_as_of=air_data.data_as_of,
        data_source=air_data.data_source,
        is_sample_or_fallback=air_data.is_sample_or_fallback,
        current_aqi=air_data.current_cpcb_aqi,
        current_band=air_data.current_aqi_band,
        active_grap_stage=air_data.active_grap_stage.stage_number
        if air_data.active_grap_stage
        else None,
        schedules=schedules,
        member_budgets=member_budgets,
        recommendations=ranked,
        outdoor_worker_advice_en=adv_en,
        outdoor_worker_advice_hi=adv_hi,
        outdoor_worker_advice_mr=adv_mr,
    )


@router.post("/plan", response_model=PlanResponse)
async def generate_day_plan(req: PlanRequest):
    return generate_day_plan_sync(req)
