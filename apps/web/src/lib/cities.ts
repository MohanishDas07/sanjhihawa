/**
 * Curated list of Indian metropolitan hubs and state capitals
 * for instant selection, alongside full Open-Meteo live search for any Indian location.
 */

export interface CityOption {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

export const POPULAR_INDIAN_CITIES: CityOption[] = [
  { name: "Delhi", region: "NCR", lat: 28.6139, lon: 77.2090 },
  { name: "Ghaziabad", region: "NCR", lat: 28.6692, lon: 77.4538 },
  { name: "Noida", region: "NCR", lat: 28.5355, lon: 77.3910 },
  { name: "Gurugram", region: "NCR", lat: 28.4595, lon: 77.0266 },
  { name: "Mumbai", region: "Maharashtra", lat: 19.0760, lon: 72.8777 },
  { name: "Pune", region: "Maharashtra", lat: 18.5204, lon: 73.8567 },
  { name: "Bengaluru", region: "Karnataka", lat: 12.9716, lon: 77.5946 },
  { name: "Bangalore", region: "Karnataka", lat: 12.9716, lon: 77.5946 },
  { name: "Hyderabad", region: "Telangana", lat: 17.3850, lon: 78.4867 },
  { name: "Kolkata", region: "West Bengal", lat: 22.5726, lon: 88.3639 },
  { name: "Chennai", region: "Tamil Nadu", lat: 13.0827, lon: 80.2707 },
  { name: "Lucknow", region: "Uttar Pradesh", lat: 26.8467, lon: 80.9462 },
  { name: "Ahmedabad", region: "Gujarat", lat: 23.0225, lon: 72.5714 },
  { name: "Jaipur", region: "Rajasthan", lat: 26.9124, lon: 75.7873 },
  { name: "Patna", region: "Bihar", lat: 25.5941, lon: 85.1376 },
  { name: "Chandigarh", region: "Punjab/Haryana", lat: 30.7333, lon: 76.7794 },
  { name: "Indore", region: "Madhya Pradesh", lat: 22.7196, lon: 75.8577 },
  { name: "Bhopal", region: "Madhya Pradesh", lat: 23.2599, lon: 77.4126 },
  { name: "Kanpur", region: "Uttar Pradesh", lat: 26.4499, lon: 80.3319 },
  { name: "Varanasi", region: "Uttar Pradesh", lat: 25.3176, lon: 82.9739 },
  { name: "Agra", region: "Uttar Pradesh", lat: 27.1767, lon: 78.0081 },
  { name: "Surat", region: "Gujarat", lat: 21.1702, lon: 72.8311 },
  { name: "Nagpur", region: "Maharashtra", lat: 21.1458, lon: 79.0882 },
  { name: "Coimbatore", region: "Tamil Nadu", lat: 11.0168, lon: 76.9558 },
  { name: "Visakhapatnam", region: "Andhra Pradesh", lat: 17.6868, lon: 83.2185 },
];
