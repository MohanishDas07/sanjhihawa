"""
Community Advisory Card Generator Router.
Generates shareable, printable advisory cards for RWAs, schools, and apartment complexes.
"""

from datetime import datetime, timezone

from engine import get_grap_stage
from fastapi import APIRouter, HTTPException
from schemas.contracts import CommunityAdvisoryRequest, CommunityAdvisoryResponse
from services.air_service import get_air_quality

router = APIRouter(tags=["Community"])


@router.post("/community/advisory", response_model=CommunityAdvisoryResponse)
async def generate_community_advisory(req: CommunityAdvisoryRequest):
    air_data = await get_air_quality(
        latitude=req.latitude,
        longitude=req.longitude,
        city_name=req.city,
    )

    if air_data.status == "no_data" or air_data.current_cpcb_aqi is None or not air_data.current_aqi_band:
        raise HTTPException(
            status_code=404,
            detail=f"No active monitoring station readings or model forecast points available for {req.city}. Cannot generate advisory bulletin.",
        )

    aqi = air_data.current_cpcb_aqi
    band = air_data.current_aqi_band
    color = air_data.current_aqi_color
    grap = get_grap_stage(aqi)

    date_str = datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p UTC")

    # Multilingual headlines & bullet points
    if req.language == "hi":
        headline = f"वायु गुणवत्ता चेतावनी: {req.city} में AQI {aqi} ({band.replace('_', ' ').title()})"
        bullets = [
            f"वर्तमान वायु गुणवत्ता स्तर: {aqi} (CPCB NAQI इंडेक्स)।",
            f"सक्रिय GRAP चरण: {grap.name if grap else 'सामान्य निगरानी'}।",
            "सुबह 6:00 से 10:00 बजे तक बाहरी खेल और भारी व्यायाम पूर्णतः स्थगित रखें।",
            "परिसर में सूखे पत्तों या कचरे को जलाने पर शून्य सहनशीलता रखें।",
            "गार्ड्स, सफाई कर्मियों और आउटडोर स्टाफ को अनिवार्य रूप से N95 मास्क प्रदान करें।",
        ]
        school_note = (
            "प्राथमिक कक्षाओं (कक्षा 5 तक) के लिए खेलकूद और प्रार्थना सभा घर के अंदर या स्थगित रखें।"
        )
        rwa_actions = [
            "सड़कों और पार्कों में धूल दबाने हेतु पानी का छिड़काव कराएं।",
            "निजी डीजल जनरेटर (DG Sets) का अनावश्यक संचालन बंद रखें।",
            "कारपूलिंग और साझा परिवहन को बढ़ावा दें।",
        ]
    elif req.language == "mr":
        headline = f"हवा गुणवत्ता सूचना: {req.city} मध्ये AQI {aqi} ({band.replace('_', ' ').title()})"
        bullets = [
            f"सध्याची हवेची गुणवत्ता पातळी: {aqi} (CPCB NAQI निर्देशांक).",
            f"सक्रिय GRAP टप्पा: {grap.name if grap else 'नियमित निरीक्षण'}.",
            "सकाळी ६ ते १० दरम्यान मैदानी खेळ आणि जास्त धावणे टाळावे.",
            "परिसरात कचरा किंवा सुका पालापाचोळा जाळण्यास सक्त मनाई आहे.",
            "सुरक्षा रक्षक आणि कामगारांना एन-९५ मास्क उपलब्ध करून द्या.",
        ]
        school_note = (
            "लहान मुलांसाठी मैदानी खेळ आणि सकाळची प्रार्थना सभागृहात किंवा ऑनलाइन आयोजित करावी."
        )
        rwa_actions = [
            "धूळ नियंत्रणासाठी रस्त्यांवर पाण्याचा शिडकावा करा.",
            "डिझेल जनरेटरचा वापर टाळून अखंड वीजपुरवठा वापरा.",
            "सार्वजनिक वाहनांचा वापर करण्यास प्रोत्साहन द्या.",
        ]
    else:
        headline = f"AIR QUALITY ADVISORY: AQI {aqi} ({band.replace('_', ' ').title()}) in {req.city}"
        bullets = [
            f"Current Air Quality: {aqi} (CPCB NAQI Index, {band.replace('_', ' ').title()}).",
            f"Active CAQM GRAP Stage: {grap.name if grap else 'Standard Monitoring'}.",
            "Postpone outdoor sports, morning assemblies, and heavy aerobic exertion between 6:00 AM and 10:00 AM.",
            "Zero tolerance on open burning of garden waste, biomass, or municipal refuse.",
            "Mandatory distribution of certified ISI/BIS N95 masks to estate guards, sweepers, and delivery partners.",
        ]
        school_note = "Schools: Suspend outdoor physical education classes. Conduct indoor yoga/table activities instead."
        rwa_actions = [
            "Initiate twice-daily water sprinkling on internal estate roads and perimeter walls.",
            "Strictly enforce ban on non-essential diesel generator (DG) set operations.",
            "Encourage carpooling among residents for peak school and office runs.",
        ]

    return CommunityAdvisoryResponse(
        organization_name=req.organization_name,
        date_formatted=date_str,
        city=req.city,
        aqi=aqi,
        aqi_band=band,
        aqi_color_hex=color,
        headline=headline,
        bulletin_points=bullets,
        school_advisory=school_note if req.organization_type == "school" else None,
        rwa_actions=rwa_actions,
        verification_source=f"{air_data.data_source} (As of {air_data.data_as_of})",
        generated_at_iso=datetime.now(timezone.utc).isoformat(),
    )
