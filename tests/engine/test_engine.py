"""
Unit Tests for SAANS Exposure Engine.
Tests all breakpoints, mass balance, masks, scheduler, sustainability, and IDW.
Runs with built-in unittest and pytest.
"""

import os
import sys
import unittest

# Ensure apps/api is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api")))

from engine import (
    PM25_BREAKPOINTS,
    ActivitySlice,
    AirStation,
    FlexibleActivity,
    calculate_daily_member_dose,
    calculate_hourly_inhaled_dose,
    calculate_indoor_concentration,
    calculate_required_cadr,
    calculate_sub_index,
    calculate_transport_emissions_avoided,
    get_grap_stage,
    get_overall_cpcb_aqi,
    interpolate_idw,
    optimize_activity_schedule,
    run_simulation,
)


class TestCPCBAQI(unittest.TestCase):
    def test_pm25_breakpoints_midpoints(self):
        # Good (0-30 ug/m3 -> 0-50 AQI)
        aqi_good, band_good = calculate_sub_index(15.0, PM25_BREAKPOINTS)
        self.assertEqual(band_good.code, "good")
        self.assertEqual(aqi_good, 25)

        # Satisfactory (30.1-60 ug/m3 -> 51-100 AQI)
        aqi_sat, band_sat = calculate_sub_index(45.0, PM25_BREAKPOINTS)
        self.assertEqual(band_sat.code, "satisfactory")
        self.assertTrue(51 <= aqi_sat <= 100)

        # Moderate (60.1-90 ug/m3 -> 101-200 AQI)
        aqi_mod, band_mod = calculate_sub_index(75.0, PM25_BREAKPOINTS)
        self.assertEqual(band_mod.code, "moderate")
        self.assertTrue(101 <= aqi_mod <= 200)

        # Poor (90.1-120 ug/m3 -> 201-300 AQI)
        aqi_poor, band_poor = calculate_sub_index(105.0, PM25_BREAKPOINTS)
        self.assertEqual(band_poor.code, "poor")
        self.assertTrue(201 <= aqi_poor <= 300)

        # Very Poor (120.1-250 ug/m3 -> 301-400 AQI)
        aqi_vp, band_vp = calculate_sub_index(185.0, PM25_BREAKPOINTS)
        self.assertEqual(band_vp.code, "very_poor")
        self.assertTrue(301 <= aqi_vp <= 400)

        # Severe (250.1-500 ug/m3 -> 401-500 AQI)
        aqi_sev, band_sev = calculate_sub_index(375.0, PM25_BREAKPOINTS)
        self.assertEqual(band_sev.code, "severe")
        self.assertTrue(401 <= aqi_sev <= 500)

    def test_pm25_boundary_values(self):
        # Zero concentration
        aqi_zero, _ = calculate_sub_index(0.0, PM25_BREAKPOINTS)
        self.assertEqual(aqi_zero, 0)

        # Negative concentration handling
        aqi_neg, _ = calculate_sub_index(-10.0, PM25_BREAKPOINTS)
        self.assertEqual(aqi_neg, 0)

        # Exact boundary 30.0 (upper Good)
        aqi_30, band_30 = calculate_sub_index(30.0, PM25_BREAKPOINTS)
        self.assertEqual(band_30.code, "good")
        self.assertEqual(aqi_30, 50)

        # Beyond 500 ug/m3: CPCB tops out at 500
        aqi_extreme, band_ext = calculate_sub_index(600.0, PM25_BREAKPOINTS)
        self.assertEqual(band_ext.code, "severe")
        self.assertEqual(aqi_extreme, 500)

    def test_aqi_capped_at_500_for_extreme_concentrations(self):
        """Audit Item 7: CPCB index tops out at 500. Verify 450, 500, and 700 ug/m3."""
        # 450 ug/m3 -> Severe, between 401 and 500
        aqi_450, band_450 = calculate_sub_index(450.0, PM25_BREAKPOINTS)
        self.assertEqual(band_450.code, "severe")
        self.assertTrue(450 <= aqi_450 <= 500)

        # 500 ug/m3 -> exactly 500
        aqi_500, band_500 = calculate_sub_index(500.0, PM25_BREAKPOINTS)
        self.assertEqual(band_500.code, "severe")
        self.assertEqual(aqi_500, 500)

        # 700 ug/m3 -> MUST be capped at 500 (never 579 or 627)
        aqi_700, band_700 = calculate_sub_index(700.0, PM25_BREAKPOINTS)
        self.assertEqual(band_700.code, "severe")
        self.assertEqual(aqi_700, 500)

    def test_overall_cpcb_composite(self):
        # PM2.5 is dominant
        _aqi, band, pollutant = get_overall_cpcb_aqi(pm25=150.0, pm10=80.0)
        self.assertEqual(pollutant, "PM2.5")
        self.assertEqual(band.code, "very_poor")

        # PM10 is dominant
        _aqi, band, pollutant = get_overall_cpcb_aqi(pm25=20.0, pm10=300.0)
        self.assertEqual(pollutant, "PM10")
        self.assertEqual(band.code, "poor")


class TestGRAPStages(unittest.TestCase):
    def test_grap_thresholds(self):
        self.assertIsNone(get_grap_stage(180))
        self.assertIsNone(get_grap_stage(200))

        stage1 = get_grap_stage(250)
        self.assertIsNotNone(stage1)
        self.assertEqual(stage1.stage_number, 1)

        stage2 = get_grap_stage(350)
        self.assertIsNotNone(stage2)
        self.assertEqual(stage2.stage_number, 2)

        stage3 = get_grap_stage(420)
        self.assertIsNotNone(stage3)
        self.assertEqual(stage3.stage_number, 3)

        stage4 = get_grap_stage(480)
        self.assertIsNotNone(stage4)
        self.assertEqual(stage4.stage_number, 4)


class TestMassBalance(unittest.TestCase):
    def test_indoor_concentration_closed_vs_open(self):
        c_out = 300.0
        # Closed standard apartment
        c_closed = calculate_indoor_concentration(c_out, envelope_type="standard_closed")
        # Open windows
        c_open = calculate_indoor_concentration(c_out, envelope_type="windows_open")

        self.assertLess(c_closed, c_out)
        self.assertGreater(c_open, c_closed)
        self.assertLessEqual(c_open, c_out)

    def test_purifier_reduces_concentration_monotonically(self):
        c_out = 300.0
        c_no_purifier = calculate_indoor_concentration(c_out, cadr_m3_per_hour=0.0)
        c_low_purifier = calculate_indoor_concentration(c_out, cadr_m3_per_hour=150.0)
        c_high_purifier = calculate_indoor_concentration(c_out, cadr_m3_per_hour=350.0)

        self.assertLess(c_low_purifier, c_no_purifier)
        self.assertLess(c_high_purifier, c_low_purifier)
        self.assertGreaterEqual(c_high_purifier, 0.0)

    def test_calculate_required_cadr(self):
        c_out = 250.0
        target = 50.0
        room_v = 35.0
        needed_cadr = calculate_required_cadr(
            target_c_in=target, c_out=c_out, room_volume_m3=room_v
        )
        self.assertGreater(needed_cadr, 0.0)

        # Verify that applying this CADR achieves target (within numerical rounding)
        achieved = calculate_indoor_concentration(
            c_out=c_out, room_volume_m3=room_v, cadr_m3_per_hour=needed_cadr
        )
        self.assertAlmostEqual(achieved, target, delta=2.0)


class TestDoseAndBreathBudget(unittest.TestCase):
    def test_hourly_dose_monotonicity(self):
        c_ambient = 200.0
        # Sleep vs moderate activity
        dose_sleep = calculate_hourly_inhaled_dose(
            c_ambient, age_band="adult", activity_level="sleep"
        )
        dose_active = calculate_hourly_inhaled_dose(
            c_ambient, age_band="adult", activity_level="moderate"
        )
        self.assertLess(dose_sleep, dose_active)

        # Mask filtration monotonicity: none > surgical > n95
        dose_no_mask = calculate_hourly_inhaled_dose(c_ambient, "adult", "light", mask_type="none")
        dose_surgical = calculate_hourly_inhaled_dose(
            c_ambient, "adult", "light", mask_type="surgical"
        )
        dose_n95 = calculate_hourly_inhaled_dose(c_ambient, "adult", "light", mask_type="n95")
        self.assertLess(dose_surgical, dose_no_mask)
        self.assertLess(dose_n95, dose_surgical)

    def test_daily_member_dose_and_benchmarks(self):
        # 24 hours of uniform 44.0 ug/m3
        slices = [
            ActivitySlice(
                name="sleep",
                duration_hours=8.0,
                pm25_concentration=44.0,
                activity_level="sleep",
            ),
            ActivitySlice(
                name="day",
                duration_hours=16.0,
                pm25_concentration=44.0,
                activity_level="sedentary",
            ),
        ]
        result = calculate_daily_member_dose("adult_1", "adult", False, slices)

        self.assertAlmostEqual(result.time_weighted_avg_pm25, 44.0, delta=0.5)
        # WHO ratio: 44 / 15 approx 2.93
        self.assertAlmostEqual(result.who_budget_ratio, 44.0 / 15.0, delta=0.05)
        # India NAAQS ratio: 44 / 60 approx 0.73
        self.assertAlmostEqual(result.india_naaqs_ratio, 44.0 / 60.0, delta=0.05)
        # Berkeley Earth cigarette equivalents: 44 / 22 = 2.0
        self.assertAlmostEqual(result.cigarette_equivalents, 2.0, delta=0.05)


class TestScheduler(unittest.TestCase):
    def test_scheduler_optimizes_morning_peak(self):
        # Winter inversion profile: high at 6-9 AM, lowest at 1-3 PM
        forecast = [
            250,
            260,
            270,
            290,
            310,
            350,
            420,
            460,
            430,
            380,  # 00:00 to 09:00
            300,
            240,
            180,
            150,
            140,
            160,
            210,
            280,
            330,
            360,  # 10:00 to 19:00
            350,
            320,
            290,
            270,  # 20:00 to 23:00
        ]
        # User default: morning exercise at 7 AM (hour 7, 460 ug/m3)
        activity = FlexibleActivity(
            id="morning_walk",
            name_en="Brisk Walk",
            name_hi="सुबह की सैर",
            name_mr="सकाळचा व्यायाम",
            duration_hours=1,
            feasible_start_hour=6,
            feasible_end_hour=17,
            default_hour=7,
            activity_level="moderate",
            is_outdoor=True,
        )
        scheduled = optimize_activity_schedule(activity, forecast)

        self.assertEqual(scheduled.baseline_hour, 7)
        self.assertEqual(scheduled.baseline_avg_pm25, 460.0)
        # Minimum window should be hour 14 (14:00, 140 ug/m3)
        self.assertEqual(scheduled.optimized_hour, 14)
        self.assertEqual(scheduled.optimized_avg_pm25, 140.0)
        self.assertEqual(scheduled.pm25_reduction_ug_m3, 320.0)
        self.assertGreater(scheduled.percentage_reduction, 60.0)


class TestSustainability(unittest.TestCase):
    def test_transport_emissions_avoided(self):
        res = calculate_transport_emissions_avoided(
            baseline_mode="two_wheeler_petrol",
            sustainable_mode="metro",
            trip_distance_km=15.0,
            community_multiplier=1,
        )
        # (0.045 - 0.001) * 15 = 0.66g PM2.5
        self.assertAlmostEqual(res.pm25_avoided_grams, 0.66, delta=0.01)
        # (0.042 - 0.019) * 15 = 0.345kg CO2e
        self.assertAlmostEqual(res.co2e_avoided_kg, 0.345, delta=0.01)

        # 200 households scale
        res_200 = calculate_transport_emissions_avoided(
            baseline_mode="two_wheeler_petrol",
            sustainable_mode="metro",
            trip_distance_km=15.0,
            community_multiplier=200,
        )
        self.assertAlmostEqual(res_200.pm25_avoided_grams, 0.66 * 200, delta=1.0)

    def test_simulation_deltas(self):
        sim = run_simulation(
            baseline_dose=1200.0,
            baseline_cigs=5.0,
            selected_intervention_ids=[
                "shift_ventilation_afternoon",
                "family_n95_masks",
            ],
        )
        self.assertLess(sim.simulated_dose_ug, 1200.0)
        self.assertGreater(sim.dose_reduction_ug, 0.0)
        self.assertLess(sim.simulated_cigs, 5.0)


class TestIDWInterpolation(unittest.TestCase):
    def test_station_snap_and_interpolation(self):
        s1 = AirStation(
            "s1",
            "Anand Vihar, Delhi",
            28.6468,
            77.3160,
            380.0,
            420,
            "2026-11-17T08:00:00Z",
        )
        s2 = AirStation(
            "s2",
            "Indirapuram, Ghaziabad",
            28.6360,
            77.3680,
            420.0,
            440,
            "2026-11-17T08:00:00Z",
        )
        stations = [s1, s2]

        # Target identical to s1 (within 200m)
        pt_snap = interpolate_idw(28.6468, 77.3160, stations)
        self.assertTrue(pt_snap.is_measured_station)
        self.assertEqual(pt_snap.estimated_pm25, 380.0)

        # Target between s1 and s2
        mid_lat = (s1.latitude + s2.latitude) / 2.0
        mid_lon = (s1.longitude + s2.longitude) / 2.0
        pt_mid = interpolate_idw(mid_lat, mid_lon, stations)
        self.assertFalse(pt_mid.is_measured_station)
        self.assertTrue(380.0 <= pt_mid.estimated_pm25 <= 420.0)


if __name__ == "__main__":
    unittest.main()
