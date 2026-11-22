"""
Air Quality Data Service with SQLite 15-minute TTL Caching and Labeled Fixture Fallback.
Implements Open-Meteo API integration with 0.1° spatial rounding and robust offline support.
"""

import json
import logging
import math
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from engine import (
    get_grap_stage,
    get_overall_cpcb_aqi,
)
from schemas.contracts import (
    AirQualityResponse,
    GeocodeItem,
    GeocodeResponse,
    GRAPStageInfo,
    HourlyAirPoint,
    ReverseGeocodeResponse,
)

logger = logging.getLogger("saans.air_service")

CACHE_DIR = Path(
    os.environ.get("CACHE_DIR", Path(__file__).resolve().parent.parent / "data")
)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

if os.environ.get("SAANS_OFFLINE") == "1" or os.environ.get("SAANS_TESTING") == "1":
    DB_PATH = ":memory:"
else:
    DB_PATH = str(CACHE_DIR / "saans_cache.sqlite3")

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "data" / "fixtures"

TTL_SECONDS = 15 * 60  # 15 minutes TTL


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in km between two coordinate pairs."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=5.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS air_cache (
            lat_rounded REAL,
            lon_rounded REAL,
            cached_at INTEGER,
            payload TEXT,
            PRIMARY KEY (lat_rounded, lon_rounded)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS geocode_cache (
            query TEXT PRIMARY KEY,
            cached_at INTEGER,
            payload TEXT
        );
        """
    )
    conn.commit()
    return conn


_conn = get_db_connection()

# In-memory fast cache (300-second TTL) for sub-millisecond repetitive coordinate evaluation
_mem_air_cache: dict[tuple[float, float], tuple[float, AirQualityResponse]] = {}


def round_coords(lat: float, lon: float) -> tuple[float, float]:
    """Rounds coordinates to approximately 0.1 degree (~11 km) for cache collapsing."""
    return round(lat, 1), round(lon, 1)


def find_closest_fixture(lat: float, lon: float) -> tuple[dict, str, float]:
    """
    Finds the closest labeled fixture among Ghaziabad, Delhi, and Lucknow.
    Returns (fixture_data, nearest_city_name, distance_km).
    """
    fixtures = [
        (28.6692, 77.4538, "Ghaziabad", FIXTURES_DIR / "ghaziabad.json"),
        (28.6139, 77.2090, "Delhi", FIXTURES_DIR / "delhi.json"),
        (26.8467, 80.9462, "Lucknow", FIXTURES_DIR / "lucknow.json"),
    ]
    best_file = fixtures[0][3]
    best_city = fixtures[0][2]
    best_dist_km = float("inf")

    for f_lat, f_lon, c_name, path in fixtures:
        d_km = calculate_distance_km(lat, lon, f_lat, f_lon)
        if d_km < best_dist_km and path.exists():
            best_dist_km = d_km
            best_file = path
            best_city = c_name

    with open(best_file, "r", encoding="utf-8") as f:
        return json.load(f), best_city, best_dist_km


CITY_ALIASES: dict[str, str] = {
    "bangalore": "bengaluru",
    "bengaluru": "bangalore",
    "bombay": "mumbai",
    "mumbai": "bombay",
    "calcutta": "kolkata",
    "kolkata": "calcutta",
    "madras": "chennai",
    "chennai": "madras",
    "gurgaon": "gurugram",
    "gurugram": "gurgaon",
    "allahabad": "prayagraj",
    "prayagraj": "allahabad",
    "benares": "varanasi",
    "kashi": "varanasi",
    "varanasi": "benares",
    "poona": "pune",
    "pune": "poona",
    "baroda": "vadodara",
    "vadodara": "baroda",
    "vizag": "visakhapatnam",
    "visakhapatnam": "vizag",
    "trivandrum": "thiruvananthapuram",
    "thiruvananthapuram": "trivandrum",
    "calicut": "kozhikode",
    "kozhikode": "calicut",
    "cochin": "kochi",
    "kochi": "cochin",
    "mysore": "mysuru",
    "mysuru": "mysore",
    "mangalore": "mangaluru",
    "mangaluru": "mangalore",
    "bellary": "ballari",
    "ballari": "bellary",
    "belgaum": "belagavi",
    "belagavi": "belgaum",
    "hubli": "hubballi",
    "hubballi": "hubli",
    "trichy": "tiruchirappalli",
    "tiruchirappalli": "trichy",
    "pondicherry": "puducherry",
    "puducherry": "pondicherry",
    "gauhati": "guwahati",
    "guwahati": "gauhati",
    "shimoga": "shivamogga",
    "shivamogga": "shimoga",
    "gulbarga": "kalaburagi",
    "kalaburagi": "gulbarga",
    "bijapur": "vijayapura",
    "vijayapura": "bijapur",
    "aurangabad": "chhatrapati sambhajinagar",
    "sambhajinagar": "chhatrapati sambhajinagar",
}

KNOWN_INDIAN_CITIES: list[GeocodeItem] = [
    # NCR & Capital
    GeocodeItem(name="Delhi", latitude=28.6139, longitude=77.2090, country="India", admin1="Delhi"),
    GeocodeItem(name="New Delhi", latitude=28.6139, longitude=77.2090, country="India", admin1="Delhi"),
    GeocodeItem(name="Ghaziabad", latitude=28.6692, longitude=77.4538, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Noida", latitude=28.5355, longitude=77.3910, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Greater Noida", latitude=28.4744, longitude=77.5040, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Gurugram", latitude=28.4595, longitude=77.0266, country="India", admin1="Haryana"),
    GeocodeItem(name="Gurgaon", latitude=28.4595, longitude=77.0266, country="India", admin1="Haryana"),
    GeocodeItem(name="Faridabad", latitude=28.4089, longitude=77.3178, country="India", admin1="Haryana"),
    # Karnataka
    GeocodeItem(name="Bengaluru", latitude=12.9716, longitude=77.5946, country="India", admin1="Karnataka"),
    GeocodeItem(name="Bangalore", latitude=12.9716, longitude=77.5946, country="India", admin1="Karnataka"),
    GeocodeItem(name="Mysuru", latitude=12.2958, longitude=76.6394, country="India", admin1="Karnataka"),
    GeocodeItem(name="Mysore", latitude=12.2958, longitude=76.6394, country="India", admin1="Karnataka"),
    GeocodeItem(name="Mangaluru", latitude=12.9141, longitude=74.8560, country="India", admin1="Karnataka"),
    GeocodeItem(name="Mangalore", latitude=12.9141, longitude=74.8560, country="India", admin1="Karnataka"),
    GeocodeItem(name="Hubballi", latitude=15.3647, longitude=75.1240, country="India", admin1="Karnataka"),
    GeocodeItem(name="Hubli", latitude=15.3647, longitude=75.1240, country="India", admin1="Karnataka"),
    GeocodeItem(name="Belagavi", latitude=15.8497, longitude=74.4977, country="India", admin1="Karnataka"),
    GeocodeItem(name="Belgaum", latitude=15.8497, longitude=74.4977, country="India", admin1="Karnataka"),
    GeocodeItem(name="Kalaburagi", latitude=17.3297, longitude=76.8343, country="India", admin1="Karnataka"),
    GeocodeItem(name="Gulbarga", latitude=17.3297, longitude=76.8343, country="India", admin1="Karnataka"),
    GeocodeItem(name="Ballari", latitude=15.1394, longitude=76.9214, country="India", admin1="Karnataka"),
    GeocodeItem(name="Bellary", latitude=15.1394, longitude=76.9214, country="India", admin1="Karnataka"),
    GeocodeItem(name="Vijayapura", latitude=16.8302, longitude=75.7100, country="India", admin1="Karnataka"),
    GeocodeItem(name="Bijapur", latitude=16.8302, longitude=75.7100, country="India", admin1="Karnataka"),
    GeocodeItem(name="Shivamogga", latitude=13.9299, longitude=75.5681, country="India", admin1="Karnataka"),
    GeocodeItem(name="Shimoga", latitude=13.9299, longitude=75.5681, country="India", admin1="Karnataka"),
    GeocodeItem(name="Tumakuru", latitude=13.3379, longitude=77.1010, country="India", admin1="Karnataka"),
    GeocodeItem(name="Tumkur", latitude=13.3379, longitude=77.1010, country="India", admin1="Karnataka"),
    GeocodeItem(name="Davanagere", latitude=14.4644, longitude=75.9218, country="India", admin1="Karnataka"),
    # Maharashtra
    GeocodeItem(name="Mumbai", latitude=19.0760, longitude=72.8777, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Bombay", latitude=19.0760, longitude=72.8777, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Pune", latitude=18.5204, longitude=73.8567, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Poona", latitude=18.5204, longitude=73.8567, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Nagpur", latitude=21.1458, longitude=79.0882, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Thane", latitude=19.2183, longitude=72.9781, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Nashik", latitude=19.9975, longitude=73.7898, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Chhatrapati Sambhajinagar", latitude=19.8762, longitude=75.3433, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Aurangabad", latitude=19.8762, longitude=75.3433, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Navi Mumbai", latitude=19.0330, longitude=73.0297, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Solapur", latitude=17.6599, longitude=75.9064, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Amravati", latitude=20.9320, longitude=77.7523, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Kolhapur", latitude=16.7050, longitude=74.2433, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Sangli", latitude=16.8524, longitude=74.5815, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Jalgaon", latitude=21.0077, longitude=75.5626, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Akola", latitude=20.7002, longitude=77.0082, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Latur", latitude=18.4088, longitude=76.5604, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Dhule", latitude=20.9042, longitude=74.7749, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Ahmednagar", latitude=19.0948, longitude=74.7480, country="India", admin1="Maharashtra"),
    GeocodeItem(name="Chandrapur", latitude=19.9615, longitude=79.2961, country="India", admin1="Maharashtra"),
    # Telangana & Andhra Pradesh
    GeocodeItem(name="Hyderabad", latitude=17.3850, longitude=78.4867, country="India", admin1="Telangana"),
    GeocodeItem(name="Warangal", latitude=17.9689, longitude=79.5941, country="India", admin1="Telangana"),
    GeocodeItem(name="Nizamabad", latitude=18.6725, longitude=78.0941, country="India", admin1="Telangana"),
    GeocodeItem(name="Khammam", latitude=17.2473, longitude=80.1514, country="India", admin1="Telangana"),
    GeocodeItem(name="Karimnagar", latitude=18.4386, longitude=79.1288, country="India", admin1="Telangana"),
    GeocodeItem(name="Visakhapatnam", latitude=17.6868, longitude=83.2185, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Vizag", latitude=17.6868, longitude=83.2185, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Vijayawada", latitude=16.5062, longitude=80.6480, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Guntur", latitude=16.3067, longitude=80.4365, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Nellore", latitude=14.4426, longitude=79.9865, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Kurnool", latitude=15.8281, longitude=78.0373, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Rajahmundry", latitude=17.0005, longitude=81.8040, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Tirupati", latitude=13.6288, longitude=79.4192, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Kadapa", latitude=14.4673, longitude=78.8242, country="India", admin1="Andhra Pradesh"),
    GeocodeItem(name="Anantapur", latitude=14.6819, longitude=77.6006, country="India", admin1="Andhra Pradesh"),
    # Tamil Nadu
    GeocodeItem(name="Chennai", latitude=13.0827, longitude=80.2707, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Madras", latitude=13.0827, longitude=80.2707, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Coimbatore", latitude=11.0168, longitude=76.9558, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Madurai", latitude=9.9252, longitude=78.1198, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Tiruchirappalli", latitude=10.7905, longitude=78.7047, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Trichy", latitude=10.7905, longitude=78.7047, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Salem", latitude=11.6643, longitude=78.1460, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Tirunelveli", latitude=8.7139, longitude=77.7567, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Tiruppur", latitude=11.1085, longitude=77.3411, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Vellore", latitude=12.9165, longitude=79.1325, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Erode", latitude=11.3410, longitude=77.7172, country="India", admin1="Tamil Nadu"),
    GeocodeItem(name="Thanjavur", latitude=10.7870, longitude=79.1378, country="India", admin1="Tamil Nadu"),
    # West Bengal
    GeocodeItem(name="Kolkata", latitude=22.5726, longitude=88.3639, country="India", admin1="West Bengal"),
    GeocodeItem(name="Calcutta", latitude=22.5726, longitude=88.3639, country="India", admin1="West Bengal"),
    GeocodeItem(name="Howrah", latitude=22.5958, longitude=88.2636, country="India", admin1="West Bengal"),
    GeocodeItem(name="Durgapur", latitude=23.5204, longitude=87.3119, country="India", admin1="West Bengal"),
    GeocodeItem(name="Asansol", latitude=23.6739, longitude=86.9524, country="India", admin1="West Bengal"),
    GeocodeItem(name="Siliguri", latitude=26.7271, longitude=88.3953, country="India", admin1="West Bengal"),
    # Gujarat
    GeocodeItem(name="Ahmedabad", latitude=23.0225, longitude=72.5714, country="India", admin1="Gujarat"),
    GeocodeItem(name="Surat", latitude=21.1702, longitude=72.8311, country="India", admin1="Gujarat"),
    GeocodeItem(name="Vadodara", latitude=22.3072, longitude=73.1812, country="India", admin1="Gujarat"),
    GeocodeItem(name="Baroda", latitude=22.3072, longitude=73.1812, country="India", admin1="Gujarat"),
    GeocodeItem(name="Rajkot", latitude=22.3039, longitude=70.8022, country="India", admin1="Gujarat"),
    GeocodeItem(name="Bhavnagar", latitude=21.7645, longitude=72.1519, country="India", admin1="Gujarat"),
    GeocodeItem(name="Jamnagar", latitude=22.4707, longitude=70.0577, country="India", admin1="Gujarat"),
    GeocodeItem(name="Gandhinagar", latitude=23.2156, longitude=72.6369, country="India", admin1="Gujarat"),
    # Rajasthan
    GeocodeItem(name="Jaipur", latitude=26.9124, longitude=75.7873, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Jodhpur", latitude=26.2389, longitude=73.0243, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Kota", latitude=25.2138, longitude=75.8648, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Bikaner", latitude=28.0229, longitude=73.3119, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Ajmer", latitude=26.4499, longitude=74.6399, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Udaipur", latitude=24.5854, longitude=73.7125, country="India", admin1="Rajasthan"),
    GeocodeItem(name="Alwar", latitude=27.5530, longitude=76.6346, country="India", admin1="Rajasthan"),
    # Uttar Pradesh
    GeocodeItem(name="Lucknow", latitude=26.8467, longitude=80.9462, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Kanpur", latitude=26.4499, longitude=80.3319, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Agra", latitude=27.1767, longitude=78.0081, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Varanasi", latitude=25.3176, longitude=82.9739, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Benares", latitude=25.3176, longitude=82.9739, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Kashi", latitude=25.3176, longitude=82.9739, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Prayagraj", latitude=25.4358, longitude=81.8463, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Allahabad", latitude=25.4358, longitude=81.8463, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Meerut", latitude=28.9845, longitude=77.7064, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Bareilly", latitude=28.3670, longitude=79.4304, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Aligarh", latitude=27.8974, longitude=78.0880, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Moradabad", latitude=28.8351, longitude=78.7747, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Saharanpur", latitude=29.9675, longitude=77.5510, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Gorakhpur", latitude=26.7606, longitude=83.3732, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Jhansi", latitude=25.4484, longitude=78.5685, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Mathura", latitude=27.4924, longitude=77.6737, country="India", admin1="Uttar Pradesh"),
    GeocodeItem(name="Ayodhya", latitude=26.7922, longitude=82.1998, country="India", admin1="Uttar Pradesh"),
    # Madhya Pradesh
    GeocodeItem(name="Bhopal", latitude=23.2599, longitude=77.4126, country="India", admin1="Madhya Pradesh"),
    GeocodeItem(name="Indore", latitude=22.7196, longitude=75.8577, country="India", admin1="Madhya Pradesh"),
    GeocodeItem(name="Jabalpur", latitude=23.1815, longitude=79.9864, country="India", admin1="Madhya Pradesh"),
    GeocodeItem(name="Gwalior", latitude=26.2183, longitude=78.1828, country="India", admin1="Madhya Pradesh"),
    GeocodeItem(name="Ujjain", latitude=23.1765, longitude=75.7885, country="India", admin1="Madhya Pradesh"),
    # Bihar & Jharkhand
    GeocodeItem(name="Patna", latitude=25.5941, longitude=85.1376, country="India", admin1="Bihar"),
    GeocodeItem(name="Gaya", latitude=24.7914, longitude=85.0002, country="India", admin1="Bihar"),
    GeocodeItem(name="Bhagalpur", latitude=25.2425, longitude=86.9842, country="India", admin1="Bihar"),
    GeocodeItem(name="Muzaffarpur", latitude=26.1209, longitude=85.3647, country="India", admin1="Bihar"),
    GeocodeItem(name="Ranchi", latitude=23.3441, longitude=85.3096, country="India", admin1="Jharkhand"),
    GeocodeItem(name="Jamshedpur", latitude=22.8046, longitude=86.2029, country="India", admin1="Jharkhand"),
    GeocodeItem(name="Dhanbad", latitude=23.7957, longitude=86.4304, country="India", admin1="Jharkhand"),
    # Punjab, Haryana & Chandigarh
    GeocodeItem(name="Chandigarh", latitude=30.7333, longitude=76.7794, country="India", admin1="Chandigarh"),
    GeocodeItem(name="Ludhiana", latitude=30.9010, longitude=75.8573, country="India", admin1="Punjab"),
    GeocodeItem(name="Amritsar", latitude=31.6340, longitude=74.8723, country="India", admin1="Punjab"),
    GeocodeItem(name="Jalandhar", latitude=31.3260, longitude=75.5762, country="India", admin1="Punjab"),
    GeocodeItem(name="Panipat", latitude=29.3909, longitude=76.9635, country="India", admin1="Haryana"),
    GeocodeItem(name="Ambala", latitude=30.3782, longitude=76.7767, country="India", admin1="Haryana"),
    GeocodeItem(name="Rohtak", latitude=28.8955, longitude=76.6066, country="India", admin1="Haryana"),
    # Uttarakhand & Himachal Pradesh
    GeocodeItem(name="Dehradun", latitude=30.3165, longitude=78.0322, country="India", admin1="Uttarakhand"),
    GeocodeItem(name="Haridwar", latitude=29.9457, longitude=78.1642, country="India", admin1="Uttarakhand"),
    GeocodeItem(name="Rishikesh", latitude=30.0869, longitude=78.2676, country="India", admin1="Uttarakhand"),
    GeocodeItem(name="Shimla", latitude=31.1048, longitude=77.1734, country="India", admin1="Himachal Pradesh"),
    GeocodeItem(name="Dharamshala", latitude=32.2190, longitude=76.3234, country="India", admin1="Himachal Pradesh"),
    # Kerala
    GeocodeItem(name="Thiruvananthapuram", latitude=8.5241, longitude=76.9366, country="India", admin1="Kerala"),
    GeocodeItem(name="Trivandrum", latitude=8.5241, longitude=76.9366, country="India", admin1="Kerala"),
    GeocodeItem(name="Kochi", latitude=9.9312, longitude=76.2673, country="India", admin1="Kerala"),
    GeocodeItem(name="Cochin", latitude=9.9312, longitude=76.2673, country="India", admin1="Kerala"),
    GeocodeItem(name="Kozhikode", latitude=11.2588, longitude=75.7804, country="India", admin1="Kerala"),
    GeocodeItem(name="Calicut", latitude=11.2588, longitude=75.7804, country="India", admin1="Kerala"),
    GeocodeItem(name="Thrissur", latitude=10.5276, longitude=76.2144, country="India", admin1="Kerala"),
    # Odisha & Chhattisgarh
    GeocodeItem(name="Bhubaneswar", latitude=20.2961, longitude=85.8245, country="India", admin1="Odisha"),
    GeocodeItem(name="Cuttack", latitude=20.4625, longitude=85.8828, country="India", admin1="Odisha"),
    GeocodeItem(name="Rourkela", latitude=22.2604, longitude=84.8536, country="India", admin1="Odisha"),
    GeocodeItem(name="Raipur", latitude=21.2514, longitude=81.6296, country="India", admin1="Chhattisgarh"),
    GeocodeItem(name="Bhilai", latitude=21.2094, longitude=81.3785, country="India", admin1="Chhattisgarh"),
    # Northeast, Goa & J&K
    GeocodeItem(name="Guwahati", latitude=26.1445, longitude=91.7362, country="India", admin1="Assam"),
    GeocodeItem(name="Gauhati", latitude=26.1445, longitude=91.7362, country="India", admin1="Assam"),
    GeocodeItem(name="Shillong", latitude=25.5788, longitude=91.8933, country="India", admin1="Meghalaya"),
    GeocodeItem(name="Agartala", latitude=23.8315, longitude=91.2868, country="India", admin1="Tripura"),
    GeocodeItem(name="Panaji", latitude=15.4909, longitude=73.8278, country="India", admin1="Goa"),
    GeocodeItem(name="Goa", latitude=15.2993, longitude=74.1240, country="India", admin1="Goa"),
    GeocodeItem(name="Srinagar", latitude=34.0837, longitude=74.7973, country="India", admin1="Jammu and Kashmir"),
    GeocodeItem(name="Jammu", latitude=32.7266, longitude=74.8570, country="India", admin1="Jammu and Kashmir"),
]


def search_city_geocoding_sync(query: str) -> GeocodeResponse:
    """Synchronous geocoding lookup for offline/fallback mode. Returns empty list if no match."""
    clean_q = query.strip().lower()
    if not clean_q:
        return GeocodeResponse(query=query, results=[])

    target = CITY_ALIASES.get(clean_q, clean_q)
    matched = []
    seen = set()
    for item in KNOWN_INDIAN_CITIES:
        name_lower = item.name.lower()
        if (clean_q in name_lower or target in name_lower) and item.name not in seen:
            matched.append(item)
            seen.add(item.name)

    # Prioritize exact matches, then alias exact matches, then prefixes
    def sort_key(item: GeocodeItem) -> int:
        nl = item.name.lower()
        if nl == clean_q:
            return 0
        if nl == target:
            return 1
        if nl.startswith(clean_q):
            return 2
        if nl.startswith(target):
            return 3
        return 4

    matched.sort(key=sort_key)
    return GeocodeResponse(query=query, results=matched)


async def search_city_geocoding(query: str) -> GeocodeResponse:
    """
    Searches cities via local index and Open-Meteo Geocoding API with SQLite cache.
    Returns empty list if no place found (never substitutes fake cities).
    """
    clean_q = query.strip().lower()
    if not clean_q:
        return GeocodeResponse(query=query, results=[])

    if os.environ.get("SAANS_OFFLINE") == "1":
        return search_city_geocoding_sync(query)

    # 1. Instantaneous local match across all known Indian cities & aliases
    local_match = search_city_geocoding_sync(query)
    if local_match.results:
        return local_match

    # 2. Check cache for previous non-empty live results
    cursor = _conn.cursor()
    cursor.execute(
        "SELECT cached_at, payload FROM geocode_cache WHERE query = ?", (clean_q,)
    )
    row = cursor.fetchone()
    now_ts = int(time.time())

    if row and (now_ts - row[0]) < 86400 * 7:  # Geocoding cached for 7 days
        data = json.loads(row[1])
        if data.get("results"):
            return GeocodeResponse(**data)

    # 3. Attempt upstream Open-Meteo API call with country filter
    upstream_q = CITY_ALIASES.get(clean_q, query)
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": upstream_q,
        "count": 6,
        "language": "en",
        "format": "json",
        "countryCode": "IN",
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("results", []):
                    results.append(
                        GeocodeItem(
                            name=item.get("name"),
                            latitude=item.get("latitude"),
                            longitude=item.get("longitude"),
                            country=item.get("country", "India"),
                            admin1=item.get("admin1"),
                        )
                    )
                if results:
                    response_obj = GeocodeResponse(query=query, results=results)
                    _conn.execute(
                        "INSERT OR REPLACE INTO geocode_cache (query, cached_at, payload) VALUES (?, ?, ?)",
                        (clean_q, now_ts, response_obj.model_dump_json()),
                    )
                    _conn.commit()
                    return response_obj
    except (httpx.HTTPError, OSError, ValueError, RuntimeError) as e:
        logger.warning(
            f"Upstream geocoding failed or unreachable: {e}. Checking local known cities."
        )

    # Fall back to local search
    return search_city_geocoding_sync(query)


def reverse_geocode_sync(latitude: float, longitude: float) -> ReverseGeocodeResponse:
    """Finds the nearest indexed Indian city or locality to the given coordinates."""
    best_item: GeocodeItem | None = None
    best_dist = float("inf")

    for item in KNOWN_INDIAN_CITIES:
        d = calculate_distance_km(latitude, longitude, item.latitude, item.longitude)
        if d < best_dist:
            best_dist = d
            best_item = item

    if best_item and best_dist <= 60.0:
        display = f"{best_item.name}, {best_item.admin1}" if best_item.admin1 else best_item.name
        return ReverseGeocodeResponse(
            name=best_item.name,
            latitude=latitude,
            longitude=longitude,
            country=best_item.country,
            admin1=best_item.admin1,
            distance_km=round(best_dist, 1),
            display_name=display,
        )
    elif best_item:
        display = f"Near {best_item.name} ({round(best_dist)} km)"
        return ReverseGeocodeResponse(
            name=best_item.name,
            latitude=latitude,
            longitude=longitude,
            country=best_item.country,
            admin1=best_item.admin1,
            distance_km=round(best_dist, 1),
            display_name=display,
        )
    else:
        return ReverseGeocodeResponse(
            name=f"{latitude:.2f}°N, {longitude:.2f}°E",
            latitude=latitude,
            longitude=longitude,
            country="India",
            admin1=None,
            distance_km=0.0,
            display_name=f"{latitude:.2f}°N, {longitude:.2f}°E",
        )


async def reverse_geocode(latitude: float, longitude: float) -> ReverseGeocodeResponse:
    """
    Reverse geocodes coordinates to a recognizable Indian city or region.
    Uses local spatial nearest-neighbor index for instant resolution.
    """
    return reverse_geocode_sync(latitude, longitude)


def _build_response_from_fixture(
    fixture_data: dict,
    city_override: str | None = None,
    nearest_city: str | None = None,
    distance_km: float = 0.0,
) -> AirQualityResponse:
    hourly_points: list[HourlyAirPoint] = []
    hourly_raw = fixture_data.get("hourly", [])

    for h in hourly_raw:
        pm25 = float(h.get("pm2_5", 0.0))
        pm10 = float(h.get("pm10", 0.0)) if h.get("pm10") is not None else None
        aqi_val, band, _ = get_overall_cpcb_aqi(pm25, pm10)
        grap = get_grap_stage(aqi_val)

        hourly_points.append(
            HourlyAirPoint(
                hour=int(h.get("hour", 0)),
                time_iso=h.get("time", f"T{h.get('hour', 0):02d}:00:00Z"),
                pm2_5=pm25,
                pm10=pm10,
                cpcb_aqi=aqi_val,
                aqi_band_code=band.code,
                aqi_band_name=band.name,
                aqi_color_hex=band.color_hex,
                health_statement_en=band.health_statement_en,
                health_statement_hi=band.health_statement_hi,
                health_statement_mr=band.health_statement_mr,
                grap_stage=grap.stage_number if grap else None,
            )
        )

    # Current hour selected according to local IST time (UTC + 5:30)
    now_utc = datetime.now(timezone.utc)
    ist_hour = (now_utc + timedelta(hours=5, minutes=30)).hour
    current_pt = next(
        (p for p in hourly_points if p.hour == ist_hour),
        (hourly_points[0] if hourly_points else None),
    )

    current_aqi = current_pt.cpcb_aqi if current_pt else 450
    current_band = current_pt.aqi_band_code if current_pt else "severe"
    current_color = current_pt.aqi_color_hex if current_pt else "#7A0F2E"
    current_pm25 = current_pt.pm2_5 if current_pt else 350.0
    current_pm10 = current_pt.pm10 if current_pt else 480.0

    grap_obj = get_grap_stage(current_aqi)
    grap_info = None
    if grap_obj:
        grap_info = GRAPStageInfo(
            stage_number=grap_obj.stage_number,
            name=grap_obj.name,
            aqi_threshold=grap_obj.aqi_threshold_text,
            mandatory_actions=grap_obj.mandatory_actions_en,
            citizen_advisory=grap_obj.citizen_advisory_en,
        )

    display_city = city_override or fixture_data.get("city", "Ghaziabad")
    ref_city = nearest_city or fixture_data.get("city", "Ghaziabad")

    if distance_km > 150.0:
        banner = (
            f"OFFLINE SAMPLE REFERENCE: No active monitoring station data in {display_city}. "
            f"Displaying regional reference snapshot from {ref_city} ({int(distance_km)} km away)."
        )
        src = f"Regional Sample: {ref_city} Station ({int(distance_km)} km away)"
        verdict_en = (
            f"No live monitoring station in {display_city}. Nearest regional reference station is "
            f"{ref_city} ({int(distance_km)} km away, estimated AQI {current_aqi})."
        )
        verdict_hi = (
            f"{display_city} में कोई सक्रिय स्टेशन नहीं है। निकटतम संदर्भ स्टेशन "
            f"{ref_city} ({int(distance_km)} किमी दूर, अनुमानित AQI {current_aqi}) है।"
        )
        verdict_mr = (
            f"{display_city} येथे सक्रिय केंद्र उपलब्ध नाही. सर्वात जवळचे संदर्भ केंद्र "
            f"{ref_city} ({int(distance_km)} किमी अंतरावर, अंदाजे AQI {current_aqi}) आहे."
        )
    else:
        banner = (
            f"RECORDED SAMPLE: {ref_city} Reference Station (17 Nov 2026 Snapshot)."
        )
        src = f"Recorded Reference: {ref_city} Station"
        verdict_en = f"Estimated air quality in {display_city} is {current_band.replace('_', ' ').title()} (AQI {current_aqi})."
        verdict_hi = f"{display_city} में अनुमानित वायु गुणवत्ता {current_band.replace('_', ' ').title()} (AQI {current_aqi}) है।"
        verdict_mr = f"{display_city} मधील अंदाजे हवेची गुणवत्ता {current_band.replace('_', ' ').title()} (AQI {current_aqi}) आहे."

    return AirQualityResponse(
        city=display_city,
        state=fixture_data.get("state", "Uttar Pradesh"),
        country=fixture_data.get("country", "India"),
        latitude=float(fixture_data.get("latitude", 28.6692)),
        longitude=float(fixture_data.get("longitude", 77.4538)),
        current_pm2_5=current_pm25,
        current_pm10=current_pm10,
        current_cpcb_aqi=current_aqi,
        current_aqi_band=current_band,
        current_aqi_color=current_color,
        dominant_pollutant="PM2.5",
        one_sentence_verdict_en=verdict_en,
        one_sentence_verdict_hi=verdict_hi,
        one_sentence_verdict_mr=verdict_mr,
        data_as_of=fixture_data.get(
            "data_as_of", datetime.now(timezone.utc).isoformat()
        ),
        data_source=src,
        is_sample_or_fallback=True,
        fallback_banner_text=banner,
        active_grap_stage=grap_info,
        hourly_forecast=hourly_points,
    )


def get_air_quality_sync(
    latitude: float,
    longitude: float,
    city_name: str | None = None,
    force_fallback: bool = False,
) -> AirQualityResponse:
    """
    Synchronous air quality retrieval for offline/fixture evaluations and test execution.
    Returns status 'no_data' for locations > 150 km away unless force_fallback is explicitly True.
    """
    is_offline = os.environ.get("SAANS_OFFLINE") == "1"
    is_testing = os.environ.get("SAANS_TESTING") == "1"
    r_lat, r_lon = round_coords(latitude, longitude)

    now = time.time()
    # Check cache unless forced fallback or offline/testing mode
    if not force_fallback and not is_offline and not is_testing:
        if (r_lat, r_lon) in _mem_air_cache:
            cached_time, cached_resp = _mem_air_cache[(r_lat, r_lon)]
            if now - cached_time < 300.0:
                if city_name:
                    cached_resp.city = city_name
                return cached_resp

        cursor = _conn.cursor()
        cursor.execute(
            "SELECT cached_at, payload FROM air_cache WHERE lat_rounded = ? AND lon_rounded = ?",
            (r_lat, r_lon),
        )
        row = cursor.fetchone()
        if row:
            data = json.loads(row[1])
            if city_name:
                data["city"] = city_name
            resp = AirQualityResponse(**data)
            _mem_air_cache[(r_lat, r_lon)] = (now, resp)
            return resp

    fixture, nearest_city, distance_km = find_closest_fixture(latitude, longitude)
    if distance_km > 150.0 and not force_fallback:
        display_city = city_name or f"Loc ({latitude}, {longitude})"
        return AirQualityResponse(
            status="no_data",
            city=display_city,
            country="India",
            latitude=latitude,
            longitude=longitude,
            current_pm2_5=None,
            current_pm10=None,
            current_cpcb_aqi=None,
            current_aqi_band=None,
            current_aqi_color="#888888",
            dominant_pollutant="PM2.5",
            one_sentence_verdict_en=f"No reading for {display_city} right now.",
            one_sentence_verdict_hi=f"वर्तमान में {display_city} के लिए कोई रीडिंग उपलब्ध नहीं है।",
            one_sentence_verdict_mr=f"सध्या {display_city} साठी कोणतेही रीडिंग उपलब्ध नाही.",
            data_as_of=f"Data fetched at {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
            data_source="No Station Coverage",
            is_sample_or_fallback=False,
            fallback_banner_text=(
                f"NO DATA: No monitoring station or high-resolution model available within 150 km of {display_city}. "
                f"Nearest reference station is {nearest_city} ({int(distance_km)} km away). Click 'Use recorded demo day' to inspect simulated demo data."
            ),
            active_grap_stage=None,
            hourly_forecast=[],
            is_modelled=False,
        )

    return _build_response_from_fixture(
        fixture,
        city_override=city_name,
        nearest_city=nearest_city,
        distance_km=distance_km,
    )


async def get_air_quality(
    latitude: float,
    longitude: float,
    city_name: str | None = None,
    force_fallback: bool = False,
) -> AirQualityResponse:
    """
    Fetches 24-hour air quality forecast for coordinates.
    Employs 15-minute SQLite caching, 0.1° spatial rounding, and labeled offline fixtures.
    """
    if os.environ.get("SAANS_OFFLINE") == "1" or os.environ.get("SAANS_TESTING") == "1":
        return get_air_quality_sync(latitude, longitude, city_name, force_fallback)

    r_lat, r_lon = round_coords(latitude, longitude)
    now_ts = int(time.time())

    is_offline = os.environ.get("SAANS_OFFLINE") == "1"

    # Check cache unless forced fallback or offline test mode
    if not force_fallback and not is_offline:
        cursor = _conn.cursor()
        cursor.execute(
            "SELECT cached_at, payload FROM air_cache WHERE lat_rounded = ? AND lon_rounded = ?",
            (r_lat, r_lon),
        )
        row = cursor.fetchone()
        if row and (now_ts - row[0]) < TTL_SECONDS:
            data = json.loads(row[1])
            return AirQualityResponse(**data)

    # Attempt upstream Open-Meteo call if not forced fallback and not offline
    if not force_fallback and not is_offline:
        url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        params = {
            "latitude": r_lat,
            "longitude": r_lon,
            "hourly": "pm2_5,pm10,temperature_2m,relative_humidity_2m",
            "forecast_days": 1,
            "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=4.5) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    api_data = resp.json()
                    hourly = api_data.get("hourly", {})
                    times = hourly.get("time", [])
                    pm25_vals = hourly.get("pm2_5", [])
                    pm10_vals = hourly.get("pm10", [])

                    points: list[HourlyAirPoint] = []
                    for idx, t in enumerate(times[:24]):
                        is_filled = False
                        if idx >= len(pm25_vals) or pm25_vals[idx] is None:
                            # Forward fill if available, and mark filled
                            if points:
                                val_25 = points[-1].pm2_5
                                is_filled = True
                            else:
                                continue
                        else:
                            val_25 = float(pm25_vals[idx])

                        if idx < len(pm10_vals) and pm10_vals[idx] is not None:
                            val_10 = float(pm10_vals[idx])
                        elif points and points[-1].pm10 is not None:
                            val_10 = points[-1].pm10
                            is_filled = True
                        else:
                            val_10 = None

                        aqi_val, band, _ = get_overall_cpcb_aqi(val_25, val_10)
                        grap = get_grap_stage(aqi_val)

                        points.append(
                            HourlyAirPoint(
                                hour=idx,
                                time_iso=t,
                                pm2_5=round(val_25, 1),
                                pm10=round(val_10, 1) if val_10 is not None else None,
                                cpcb_aqi=aqi_val,
                                aqi_band_code=band.code,
                                aqi_band_name=band.name,
                                aqi_color_hex=band.color_hex,
                                health_statement_en=band.health_statement_en,
                                health_statement_hi=band.health_statement_hi,
                                health_statement_mr=band.health_statement_mr,
                                grap_stage=grap.stage_number if grap else None,
                                is_filled=is_filled,
                            )
                        )

                    if not points:
                        # Audit 2 R9: return no_data rather than invented 150/80/120 defaults
                        return AirQualityResponse(
                            status="no_data",
                            city=city_name or f"Loc ({r_lat}, {r_lon})",
                            country="India",
                            latitude=latitude,
                            longitude=longitude,
                            current_pm2_5=None,
                            current_pm10=None,
                            current_cpcb_aqi=None,
                            current_aqi_band=None,
                            current_aqi_color="#888888",
                            dominant_pollutant="PM2.5",
                            one_sentence_verdict_en=f"No air quality forecast points available for {city_name or 'this location'}.",
                            one_sentence_verdict_hi=f"{city_name or 'इस स्थान'} के लिए कोई पूर्वानुमान बिंदु उपलब्ध नहीं हैं।",
                            one_sentence_verdict_mr=f"{city_name or 'या ठिकाणासाठी'} कोणतेही अंदाज उपलब्ध नाहीत.",
                            data_as_of=f"Data fetched at {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
                            data_source="Open-Meteo (Empty Grid)",
                            is_sample_or_fallback=False,
                            fallback_banner_text="EMPTY GRID: No modelled data points returned for this location.",
                            active_grap_stage=None,
                            hourly_forecast=[],
                            is_modelled=True,
                        )

                    # Select point corresponding to current local hour
                    utc_offset = api_data.get("utc_offset_seconds", 19800)
                    now_utc = datetime.now(timezone.utc)
                    local_hour = (now_utc + timedelta(seconds=utc_offset)).hour
                    cur = next(
                        (p for p in points if p.hour == local_hour),
                        points[0],
                    )
                    cur_aqi = cur.cpcb_aqi
                    cur_band = cur.aqi_band_code
                    cur_color = cur.aqi_color_hex

                    grap_stage_cur = get_grap_stage(cur_aqi)
                    grap_info = None
                    if grap_stage_cur:
                        grap_info = GRAPStageInfo(
                            stage_number=grap_stage_cur.stage_number,
                            name=grap_stage_cur.name,
                            aqi_threshold=grap_stage_cur.aqi_threshold_text,
                            mandatory_actions=grap_stage_cur.mandatory_actions_en,
                            citizen_advisory=grap_stage_cur.citizen_advisory_en,
                        )

                    res_obj = AirQualityResponse(
                        status="ok",
                        city=city_name or f"Loc ({r_lat}, {r_lon})",
                        country="India",
                        latitude=latitude,
                        longitude=longitude,
                        current_pm2_5=cur.pm2_5,
                        current_pm10=cur.pm10,
                        current_cpcb_aqi=cur_aqi,
                        current_aqi_band=cur_band,
                        current_aqi_color=cur_color,
                        dominant_pollutant="PM2.5",
                        one_sentence_verdict_en=f"Modelled air quality estimate is {cur_band.replace('_', ' ').title()} (AQI {cur_aqi}, estimated from hourly PM2.5).",
                        one_sentence_verdict_hi=f"मॉडल अनुमानित वायु गुणवत्ता {cur_band.replace('_', ' ').title()} (AQI {cur_aqi}) है।",
                        one_sentence_verdict_mr=f"मॉडेल अंदाजित हवेची गुणवत्ता {cur_band.replace('_', ' ').title()} (AQI {cur_aqi}) आहे.",
                        data_as_of=f"Data fetched at {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
                        data_source="Modelled estimate (CAMS via Open-Meteo), not a ground station",
                        is_sample_or_fallback=False,
                        active_grap_stage=grap_info,
                        hourly_forecast=points,
                        is_modelled=True,
                    )

                    _conn.execute(
                        "INSERT OR REPLACE INTO air_cache (lat_rounded, lon_rounded, cached_at, payload) VALUES (?, ?, ?, ?)",
                        (r_lat, r_lon, now_ts, res_obj.model_dump_json()),
                    )
                    _conn.commit()
                    return res_obj
        except (httpx.HTTPError, OSError, ValueError, RuntimeError) as e:
            logger.warning(
                f"Failed to fetch live air data from Open-Meteo: {e}. Using offline fixtures."
            )

    # Resilient offline fixture fallback
    fixture, nearest_city, distance_km = find_closest_fixture(latitude, longitude)
    if distance_km > 150.0 and not force_fallback:
        display_city = city_name or f"Loc ({latitude}, {longitude})"
        return AirQualityResponse(
            status="no_data",
            city=display_city,
            country="India",
            latitude=latitude,
            longitude=longitude,
            current_pm2_5=None,
            current_pm10=None,
            current_cpcb_aqi=None,
            current_aqi_band=None,
            current_aqi_color="#888888",
            dominant_pollutant="PM2.5",
            one_sentence_verdict_en=f"No reading for {display_city} right now.",
            one_sentence_verdict_hi=f"वर्तमान में {display_city} के लिए कोई रीडिंग उपलब्ध नहीं है।",
            one_sentence_verdict_mr=f"सध्या {display_city} साठी कोणतेही रीडिंग उपलब्ध नाही.",
            data_as_of=f"Data fetched at {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
            data_source="No Station Coverage",
            is_sample_or_fallback=False,
            fallback_banner_text=(
                f"NO DATA: No monitoring station or high-resolution model available within 150 km of {display_city}. "
                f"Nearest reference station is {nearest_city} ({int(distance_km)} km away). Click 'Use recorded demo day' to inspect simulated demo data."
            ),
            active_grap_stage=None,
            hourly_forecast=[],
            is_modelled=False,
        )

    return _build_response_from_fixture(
        fixture,
        city_override=city_name,
        nearest_city=nearest_city,
        distance_km=distance_km,
    )
