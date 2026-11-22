"""
Advanced Edge Case and Stress Tests for SAANS Exposure Engine.
Exhaustively tests mathematical boundaries, multi-pollutant composites,
mass balance extremes, and inhalation dose mechanics.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api")))

from engine import (
    PM10_BREAKPOINTS,
    PM25_BREAKPOINTS,
    ActivitySlice,
    AirStation,
    FlexibleActivity,
    calculate_daily_member_dose,
    calculate_hourly_inhaled_dose,
    calculate_indoor_concentration,
    calculate_required_cadr,
    calculate_sub_index,
    get_grap_stage,
    get_overall_cpcb_aqi,
    interpolate_idw,
    optimize_activity_schedule,
)


class TestCPCBAQIExtremeBoundaries(unittest.TestCase):
    def test_zero_and_near_zero(self):
        aqi_0, band_0 = calculate_sub_index(0.0, PM25_BREAKPOINTS)
        self.assertEqual(aqi_0, 0)
        self.assertEqual(band_0.code, "good")

        aqi_micro, band_micro = calculate_sub_index(0.001, PM25_BREAKPOINTS)
        self.assertEqual(aqi_micro, 0)
        self.assertEqual(band_micro.code, "good")

    def test_negative_values_clamp_to_zero(self):
        aqi_neg, band_neg = calculate_sub_index(-50.0, PM25_BREAKPOINTS)
        self.assertEqual(aqi_neg, 0)
        self.assertEqual(band_neg.code, "good")

    def test_extreme_smog_1000_ug_m3(self):
        aqi_1000, band_1000 = calculate_sub_index(1000.0, PM25_BREAKPOINTS)
        self.assertEqual(aqi_1000, 500)
        self.assertEqual(band_1000.code, "severe")

    def test_all_cpcb_pm10_breakpoints(self):
        # PM10 Good: 0-50 -> 0-50
        aqi_pm10_good, _ = calculate_sub_index(25.0, PM10_BREAKPOINTS)
        self.assertEqual(aqi_pm10_good, 25)

        # PM10 Satisfactory: 51-100 -> 51-100
        aqi_pm10_sat, _ = calculate_sub_index(75.0, PM10_BREAKPOINTS)
        self.assertEqual(aqi_pm10_sat, 75)

        # PM10 Moderate: 101-250 -> 101-200
        aqi_pm10_mod, b_mod = calculate_sub_index(175.0, PM10_BREAKPOINTS)
        self.assertEqual(b_mod.code, "moderate")
        self.assertTrue(101 <= aqi_pm10_mod <= 200)

        # PM10 Severe: 430+ -> 401-500
        aqi_pm10_sev, b_sev = calculate_sub_index(500.0, PM10_BREAKPOINTS)
        self.assertEqual(b_sev.code, "severe")
        self.assertEqual(aqi_pm10_sev, 500)

    def test_cpcb_composite_pollutant_tie(self):
        # Both PM2.5 and PM10 give exact same AQI
        aqi, band, pollutant = get_overall_cpcb_aqi(pm25=30.0, pm10=50.0)
        self.assertEqual(aqi, 50)
        self.assertEqual(band.code, "good")
        self.assertIn(pollutant, ["PM2.5", "PM10"])

    def test_cpcb_single_pollutant_only(self):
        # Only PM2.5 provided
        aqi, band, pol = get_overall_cpcb_aqi(pm25=120.0, pm10=None)
        self.assertIsNotNone(aqi)
        self.assertEqual(pol, "PM2.5")

        # Only PM10 provided
        aqi_10, _, pol_10 = get_overall_cpcb_aqi(pm25=None, pm10=250.0)
        self.assertIsNotNone(aqi_10)
        self.assertEqual(pol_10, "PM10")


class TestGRAPStageTransitions(unittest.TestCase):
    def test_exact_grap_threshold_boundaries(self):
        # 200: No GRAP
        self.assertIsNone(get_grap_stage(200))
        # 201: Stage 1 (Poor)
        s1 = get_grap_stage(201)
        self.assertIsNotNone(s1)
        self.assertEqual(s1.stage_number, 1)

        # 300: Stage 1
        self.assertEqual(get_grap_stage(300).stage_number, 1)
        # 301: Stage 2 (Very Poor)
        s2 = get_grap_stage(301)
        self.assertIsNotNone(s2)
        self.assertEqual(s2.stage_number, 2)

        # 400: Stage 2
        self.assertEqual(get_grap_stage(400).stage_number, 2)
        # 401: Stage 3 (Severe)
        s3 = get_grap_stage(401)
        self.assertIsNotNone(s3)
        self.assertEqual(s3.stage_number, 3)

        # 450: Stage 3
        self.assertEqual(get_grap_stage(450).stage_number, 3)
        # 451: Stage 4 (Severe+)
        s4 = get_grap_stage(451)
        self.assertIsNotNone(s4)
        self.assertEqual(s4.stage_number, 4)


class TestMassBalancePhysicalLimits(unittest.TestCase):
    def test_extreme_room_volumes(self):
        # Tiny bathroom: 8 m3
        c_bath = calculate_indoor_concentration(300.0, room_volume_m3=8.0, cadr_m3_per_hour=100.0)
        self.assertLess(c_bath, 100.0)

        # Large open banquet hall: 1000 m3
        c_hall = calculate_indoor_concentration(
            300.0, room_volume_m3=1000.0, cadr_m3_per_hour=100.0
        )
        # Purifier has minimal impact in massive hall (remains > 140 ug/m3)
        self.assertGreater(c_hall, 140.0)

    def test_cadr_target_higher_than_ambient(self):
        # Target is 200 ug/m3, outdoor is only 100 ug/m3 -> No purifier needed
        cadr_needed = calculate_required_cadr(target_c_in=200.0, c_out=100.0, room_volume_m3=40.0)
        self.assertEqual(cadr_needed, 0.0)

    def test_cadr_impossible_target(self):
        # Target 0 ug/m3 with non-zero outdoor air
        # Mass balance asymptote: cannot reach absolute zero without infinite CADR
        cadr_near_zero = calculate_required_cadr(target_c_in=1.0, c_out=500.0, room_volume_m3=30.0)
        self.assertGreater(cadr_near_zero, 1000.0)


class TestDoseCohortMechanics(unittest.TestCase):
    def test_child_inhalation_rate_vs_adult(self):
        c_ambient = 150.0
        # Child has lower absolute tidal volume than adult
        child_dose = calculate_hourly_inhaled_dose(
            c_ambient, age_band="child", activity_level="light"
        )
        adult_dose = calculate_hourly_inhaled_dose(
            c_ambient, age_band="adult", activity_level="light"
        )
        self.assertLess(child_dose, adult_dose)

    def test_senior_breathing_sensitivity(self):
        slices = [
            ActivitySlice(
                name="day",
                duration_hours=24.0,
                pm25_concentration=100.0,
                activity_level="sedentary",
            )
        ]
        res_normal = calculate_daily_member_dose("senior_1", "senior", False, slices)
        res_sensitive = calculate_daily_member_dose("senior_2", "senior", True, slices)

        # Same PM2.5 time-weighted average
        self.assertEqual(res_normal.time_weighted_avg_pm25, res_sensitive.time_weighted_avg_pm25)
        self.assertEqual(res_normal.cigarette_equivalents, res_sensitive.cigarette_equivalents)

    def test_all_mask_types_filtration_rank(self):
        c = 300.0
        masks = ["none", "cloth", "surgical", "n95_loose", "n95"]
        doses = [calculate_hourly_inhaled_dose(c, "adult", "moderate", mask_type=m) for m in masks]

        # Each progressive mask must deliver strictly less dose
        for i in range(len(doses) - 1):
            self.assertLess(doses[i + 1], doses[i])


class TestSchedulerEdgeCases(unittest.TestCase):
    def test_flat_forecast_no_shift_needed(self):
        flat_forecast = [200.0] * 24
        activity = FlexibleActivity(
            id="routine",
            name_en="Task",
            name_hi="कार्य",
            name_mr="काम",
            duration_hours=2,
            feasible_start_hour=8,
            feasible_end_hour=16,
            default_hour=10,
            activity_level="moderate",
            is_outdoor=True,
        )
        scheduled = optimize_activity_schedule(activity, flat_forecast)
        self.assertEqual(scheduled.pm25_reduction_ug_m3, 0.0)
        self.assertEqual(scheduled.percentage_reduction, 0.0)

    def test_multi_hour_duration_activity(self):
        # 3-hour outdoor sport activity
        varying_forecast = [
            400,
            420,
            430,
            410,
            380,
            350,
            300,
            250,
            200,
            150,
            120,
            110,
            115,
            125,
            140,
            180,
            220,
            270,
            310,
            340,
            370,
            390,
            410,
            420,
        ]
        activity = FlexibleActivity(
            id="sports",
            name_en="Cricket",
            name_hi="क्रिकेट",
            name_mr="क्रिकेट",
            duration_hours=3,
            feasible_start_hour=6,
            feasible_end_hour=18,
            default_hour=6,
            activity_level="heavy",
            is_outdoor=True,
        )
        scheduled = optimize_activity_schedule(activity, varying_forecast)
        # Optimal 3-hour window should center around lowest midday dip (hours 10-13)
        self.assertTrue(9 <= scheduled.optimized_hour <= 12)
        self.assertGreater(scheduled.percentage_reduction, 50.0)


class TestSpatialIDWTriangulation(unittest.TestCase):
    def test_three_stations_interpolation(self):
        s1 = AirStation("s1", "North Station", 28.70, 77.10, 300.0, 350, "2026-11-20T00:00:00Z")
        s2 = AirStation("s2", "East Station", 28.70, 77.30, 400.0, 420, "2026-11-20T00:00:00Z")
        s3 = AirStation("s3", "South Station", 28.50, 77.20, 200.0, 250, "2026-11-20T00:00:00Z")

        # Centroid of the triangle
        c_lat = (28.70 + 28.70 + 28.50) / 3.0
        c_lon = (77.10 + 77.30 + 77.20) / 3.0

        pt = interpolate_idw(c_lat, c_lon, [s1, s2, s3])
        self.assertFalse(pt.is_measured_station)
        # Result must strictly lie within min and max of bounding stations
        self.assertTrue(200.0 < pt.estimated_pm25 < 400.0)


if __name__ == "__main__":
    unittest.main()
