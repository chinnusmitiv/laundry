import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

// Real Singapore map using OneMap tiles (Singapore Land Authority) + Leaflet, same tile
// source as shared/index.jsx's web <OneMap>. Rendered inside a WebView since there's no
// native OneMap SDK — this is the one screen element that can't be pure RN views.
const HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#dde3f0}
  .cl-pin{font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
  .cl-pulse{width:18px;height:18px;border-radius:50%;background:#C7FF33;border:2px solid #1D2951;animation:clpulse 1.6s infinite}
  @keyframes clpulse{0%{box-shadow:0 0 0 0 rgba(199,255,51,.55)}70%{box-shadow:0 0 0 16px rgba(199,255,51,0)}100%{box-shadow:0 0 0 0 rgba(199,255,51,0)}}
</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([1.3521, 103.8198], 12);
  L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
    detectRetina: true, maxZoom: 18, minZoom: 11,
    attribution: '&copy; OneMap &copy; Singapore Land Authority',
  }).addTo(map);
  var driverIcon = L.divIcon({ className: '', html: '<div class="cl-pulse"></div>', iconSize: [20,20], iconAnchor: [10,10] });
  var pinIcon = L.divIcon({ className: '', html: '<div class="cl-pin">📍</div>', iconSize: [28,28], iconAnchor: [14,28] });
  var dMark = null, destMark = null;
  window.updateMap = function(driver, dest) {
    var pts = [];
    if (dest && dest.lat) {
      var dl = [dest.lat, dest.lng];
      if (!destMark) destMark = L.marker(dl, { icon: pinIcon }).addTo(map); else destMark.setLatLng(dl);
      pts.push(dl);
    }
    if (driver && driver.lat) {
      var dr = [driver.lat, driver.lng];
      if (!dMark) dMark = L.marker(dr, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map); else dMark.setLatLng(dr);
      pts.push(dr);
    }
    map.invalidateSize();
    if (pts.length === 1) map.setView(pts[0], 16, { animate: true });
    else if (pts.length > 1) map.fitBounds(pts, { padding: [44,44], maxZoom: 16 });
  };
  setTimeout(function(){ map.invalidateSize(); }, 150);
</script></body></html>`;

export function OneMap({ driver, dest, height = 220 }) {
  const ref = useRef(null);
  const update = () => ref.current?.injectJavaScript(`window.updateMap(${JSON.stringify(driver || null)}, ${JSON.stringify(dest || null)}); true;`);

  useEffect(() => { update(); }, [driver?.lat, driver?.lng, dest?.lat, dest?.lng]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#dde3f0' }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: HTML }}
        onLoadEnd={update}
        style={{ backgroundColor: 'transparent' }}
        javaScriptEnabled
        scrollEnabled={false}
      />
    </View>
  );
}
