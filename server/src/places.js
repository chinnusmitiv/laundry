// Mock Singapore places dataset — stands in for the Google Maps Places API.
// Search is a simple case-insensitive match across name / area / postcode.
// Each entry: { name (building/landmark), line1, area, postcode, lat, lng }.

export const PLACES = [
  // Central
  { name: 'Tiong Bahru Plaza', line1: '302 Tiong Bahru Road', area: 'Tiong Bahru', postcode: '168732', lat: 1.2847, lng: 103.8270 },
  { name: 'The Pinnacle @ Duxton', line1: '1 Cantonment Road', area: 'Tanjong Pagar', postcode: '085897', lat: 1.2757, lng: 103.8417 },
  { name: 'Tanjong Pagar Centre', line1: '7 Wallich Street', area: 'Tanjong Pagar', postcode: '078884', lat: 1.2766, lng: 103.8455 },
  { name: 'Orchard Central', line1: '181 Orchard Road', area: 'Orchard', postcode: '238896', lat: 1.3009, lng: 103.8392 },
  { name: 'ION Orchard', line1: '2 Orchard Turn', area: 'Orchard', postcode: '238801', lat: 1.3041, lng: 103.8318 },
  { name: 'Raffles Place', line1: '5 Raffles Place', area: 'Raffles Place', postcode: '048618', lat: 1.2841, lng: 103.8515 },
  { name: 'Clarke Quay Central', line1: '6 Eu Tong Sen Street', area: 'Clarke Quay', postcode: '059817', lat: 1.2884, lng: 103.8466 },
  { name: 'Marina Bay Sands', line1: '10 Bayfront Avenue', area: 'Marina Bay', postcode: '018956', lat: 1.2834, lng: 103.8607 },
  { name: 'Bugis Junction', line1: '200 Victoria Street', area: 'Bugis', postcode: '188021', lat: 1.2996, lng: 103.8554 },
  { name: 'Novena Square', line1: '238 Thomson Road', area: 'Novena', postcode: '307683', lat: 1.3204, lng: 103.8438 },
  // East
  { name: 'Parkway Parade', line1: '80 Marine Parade Road', area: 'Marine Parade', postcode: '449269', lat: 1.3015, lng: 103.9050 },
  { name: 'i12 Katong', line1: '112 East Coast Road', area: 'Katong', postcode: '428802', lat: 1.3046, lng: 103.9050 },
  { name: 'Bedok Mall', line1: '311 New Upper Changi Road', area: 'Bedok', postcode: '467360', lat: 1.3253, lng: 103.9292 },
  { name: 'Tampines Mall', line1: '4 Tampines Central 5', area: 'Tampines', postcode: '529510', lat: 1.3525, lng: 103.9447 },
  { name: 'Changi City Point', line1: '5 Changi Business Park Central 1', area: 'Changi', postcode: '486038', lat: 1.3342, lng: 103.9622 },
  { name: 'Paya Lebar Quarter', line1: '10 Paya Lebar Road', area: 'Paya Lebar', postcode: '409057', lat: 1.3180, lng: 103.8932 },
  // West
  { name: 'Jurong Point', line1: '1 Jurong West Central 2', area: 'Jurong West', postcode: '648886', lat: 1.3399, lng: 103.7070 },
  { name: 'JEM', line1: '50 Jurong Gateway Road', area: 'Jurong East', postcode: '608549', lat: 1.3331, lng: 103.7434 },
  { name: 'Clementi Mall', line1: '3155 Commonwealth Avenue West', area: 'Clementi', postcode: '129588', lat: 1.3151, lng: 103.7644 },
  { name: 'Holland Village', line1: '21 Lorong Liput', area: 'Holland Village', postcode: '277733', lat: 1.3110, lng: 103.7960 },
  { name: 'Star Vista', line1: '1 Vista Exchange Green', area: 'Buona Vista', postcode: '138617', lat: 1.3070, lng: 103.7884 },
  { name: 'West Coast Plaza', line1: '154 West Coast Road', area: 'West Coast', postcode: '127371', lat: 1.3098, lng: 103.7656 },
  // North
  { name: 'Causeway Point', line1: '1 Woodlands Square', area: 'Woodlands', postcode: '738099', lat: 1.4360, lng: 103.7860 },
  { name: 'Northpoint City', line1: '930 Yishun Avenue 2', area: 'Yishun', postcode: '769098', lat: 1.4294, lng: 103.8350 },
  { name: 'AMK Hub', line1: '53 Ang Mo Kio Avenue 3', area: 'Ang Mo Kio', postcode: '569933', lat: 1.3691, lng: 103.8489 },
  { name: 'Junction 8', line1: '9 Bishan Place', area: 'Bishan', postcode: '579837', lat: 1.3508, lng: 103.8485 },
  // North-East
  { name: 'NEX', line1: '23 Serangoon Central', area: 'Serangoon', postcode: '556083', lat: 1.3505, lng: 103.8720 },
  { name: 'Compass One', line1: '1 Sengkang Square', area: 'Sengkang', postcode: '545078', lat: 1.3917, lng: 103.8951 },
  { name: 'Waterway Point', line1: '83 Punggol Central', area: 'Punggol', postcode: '828761', lat: 1.4071, lng: 103.9024 },
  { name: 'Hougang Mall', line1: '90 Hougang Avenue 10', area: 'Hougang', postcode: '538766', lat: 1.3727, lng: 103.8934 },
  { name: 'Heartland Mall', line1: '205 Hougang Street 21', area: 'Kovan', postcode: '530205', lat: 1.3601, lng: 103.8853 },
  // Popular residential roads
  { name: 'Toa Payoh HDB Hub', line1: '480 Lorong 6 Toa Payoh', area: 'Toa Payoh', postcode: '310480', lat: 1.3324, lng: 103.8470 },
  { name: 'Tiong Bahru Estate', line1: '55 Tiong Bahru Road', area: 'Tiong Bahru', postcode: '160055', lat: 1.2862, lng: 103.8268 },
  { name: 'Queenstown MRT', line1: '95 Commonwealth Avenue', area: 'Queenstown', postcode: '149577', lat: 1.2945, lng: 103.8060 },
  { name: 'Redhill Close', line1: '78 Redhill Close', area: 'Bukit Merah', postcode: '150078', lat: 1.2895, lng: 103.8170 },
];

// Real Singapore address search via OneMap (Singapore Land Authority).
// The public elastic/search endpoint returns results even without a token;
// if ONEMAP_TOKEN is set we send it. On any failure we fall back to PLACES.
export async function searchOneMap(q) {
  const s = (q || '').trim();
  if (s.length < 2) return [];
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(s)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const headers = {};
    if (process.env.ONEMAP_TOKEN) headers.Authorization = process.env.ONEMAP_TOKEN;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r) => r.LATITUDE && r.LONGITUDE && r.POSTAL && r.POSTAL !== 'NIL')
      .slice(0, 6)
      .map((r) => {
        const building = r.BUILDING && r.BUILDING !== 'NIL' ? r.BUILDING : null;
        const line1 = [r.BLK_NO, r.ROAD_NAME].filter((x) => x && x !== 'NIL').join(' ');
        return {
          name: building || line1 || r.SEARCHVAL,
          line1: line1 || r.SEARCHVAL,
          area: '',
          postcode: r.POSTAL,
          lat: Number(r.LATITUDE),
          lng: Number(r.LONGITUDE),
          description: r.ADDRESS || `${line1} Singapore ${r.POSTAL}`,
        };
      });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function searchPlaces(q) {
  const s = (q || '').trim().toLowerCase();
  if (s.length < 2) return [];
  const matches = PLACES.filter((p) =>
    p.name.toLowerCase().includes(s) ||
    p.area.toLowerCase().includes(s) ||
    p.line1.toLowerCase().includes(s) ||
    p.postcode.includes(s));
  // rank: name startsWith first, then area, then the rest
  matches.sort((a, b) => {
    const ai = a.name.toLowerCase().startsWith(s) ? 0 : a.area.toLowerCase().startsWith(s) ? 1 : 2;
    const bi = b.name.toLowerCase().startsWith(s) ? 0 : b.area.toLowerCase().startsWith(s) ? 1 : 2;
    return ai - bi;
  });
  return matches.slice(0, 6).map((p) => ({
    ...p,
    description: `${p.name}, ${p.line1}, Singapore ${p.postcode}`,
  }));
}
