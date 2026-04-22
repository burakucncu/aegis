Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    shouldAnimate: true, animation: true, timeline: true,
    baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: true, infoBox: false, navigationHelpButton: false, skyAtmosphere: false
});

viewer.scene.globe.maximumScreenSpaceError = 2;
viewer.resolutionScale = 1.0;
viewer.scene.postProcessStages.fxaa.enabled = true;
viewer.scene.globe.enableLighting = true;

viewer.imageryLayers.removeAll();
Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', { maximumLevel: 13 }
).then(provider => viewer.imageryLayers.addImageryProvider(provider));

// --- DİNAMİK BATARYA LİSTESİ ---
let defenseBatteries = [
    { name: "Aegis-İstanbul", lat: 41.008, lon: 28.978 },
    { name: "Aegis-Ankara", lat: 39.933, lon: 32.859 },
    { name: "Aegis-Erzurum", lat: 39.904, lon: 41.267 },
    { name: "Aegis-Hatay", lat: 36.202, lon: 36.160 },
    { name: "Aegis-İzmir", lat: 38.419, lon: 27.128 }
];

// --- ULUSAL HAVA SAHASI (TÜM TÜRKİYE'Yİ KAPSAYACAK ŞEKİLDE BÜYÜTÜLDÜ) ---
const nationalCenterLat = 39.0; 
const nationalCenterLon = 35.2;
const nationalRadius = 850000.0; // 850 km yarıçap ile Edirne'den Hakkari'ye kapsama

viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(35.2, 39.0, 4000000.0),
    duration: 2
});

// Arayüzdeki listeyi ve haritadaki çizimleri güncelleyen fonksiyon
function renderNetwork() {
    viewer.entities.removeAll();

    // 1. Dev Ulusal Kalkanı Çiz
    viewer.entities.add({
        name: "Türkiye Ulusal Hava Sahası",
        position: Cesium.Cartesian3.fromDegrees(nationalCenterLon, nationalCenterLat, 0),
        ellipsoid: {
            radii: new Cesium.Cartesian3(nationalRadius, nationalRadius, nationalRadius),
            maximumCone: Cesium.Math.PI_OVER_TWO,
            material: Cesium.Color.CYAN.withAlpha(0.05),
            outline: true, outlineColor: Cesium.Color.CYAN.withAlpha(0.15)
        }
    });

    // 2. Tüm Bataryaları Çiz
    const listDiv = document.getElementById('battery-list');
    listDiv.innerHTML = ""; // UI Listesini temizle

    defenseBatteries.forEach(battery => {
        // Haritaya ekle
        viewer.entities.add({
            name: battery.name,
            position: Cesium.Cartesian3.fromDegrees(battery.lon, battery.lat, 0),
            point: { pixelSize: 8, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
            label: { text: battery.name, font: '10pt monospace', pixelOffset: new Cesium.Cartesian2(0, 15), fillColor: Cesium.Color.CYAN }
        });
        
        // UI Listesine ekle
        listDiv.innerHTML += `<div>📡 ${battery.name} (${battery.lat.toFixed(2)}, ${battery.lon.toFixed(2)})</div>`;
    });
}

// Uygulama açıldığında ağı çiz
renderNetwork();

// --- YENİ BATARYA EKLEME BUTONU ---
document.getElementById('add-bat-btn').addEventListener('click', () => {
    const name = document.getElementById('new-bat-name').value;
    const lat = parseFloat(document.getElementById('new-bat-lat').value);
    const lon = parseFloat(document.getElementById('new-bat-lon').value);

    if(name && !isNaN(lat) && !isNaN(lon)) {
        defenseBatteries.push({ name: name, lat: lat, lon: lon });
        renderNetwork(); // Haritayı ve UI'ı yenile
        
        // Yeni bir örnek batarya önerisi yaz
        document.getElementById('new-bat-name').value = "Aegis-Yeni";
    } else {
        alert("Lütfen geçerli değerler girin!");
    }
});

// --- SİMÜLASYON BAŞLATMA ---
document.getElementById('start-btn').addEventListener('click', () => {
    // Saldırı başladığında haritayı temizleyip kalkan/bataryaları yeniden çizeriz
    renderNetwork(); 
    
    document.getElementById('results').style.display = 'block';
    document.getElementById('entry-info').innerText = `Sınıra Giriş: --:--`;
    document.getElementById('intercept-info').innerText = `İmha Konumu: --, --`;
    document.getElementById('status-msg').innerText = "ULUSAL RADAR: TEHDİT BEKLENİYOR...";
    document.getElementById('status-msg').style.color = "#ffeb3b";

    const targetLat = parseFloat(document.getElementById('def-lat').value);
    const targetLon = parseFloat(document.getElementById('def-lon').value);
    const threatLat = parseFloat(document.getElementById('threat-lat').value);
    const threatLon = parseFloat(document.getElementById('threat-lon').value);

    const targetPos = Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 0);
    const launchPos = Cesium.Cartesian3.fromDegrees(threatLon, threatLat, 0);
    const nationalCenterPos = Cesium.Cartesian3.fromDegrees(nationalCenterLon, nationalCenterLat, 0);

    const duration = 180; 
    const startTime = viewer.clock.currentTime;
    const maxHeight = 150000; 

    const threatPosProp = new Cesium.SampledPositionProperty();
    let activeBattery = null;
    let interceptPoint = null;
    let interceptTime = null;
    let interceptSecond = 0;

    // YÖRÜNGE VE ÇARPIŞMA HESAPLAMA
    for (let i = 0; i <= duration; i++) {
        const time = Cesium.JulianDate.addSeconds(startTime, i, new Cesium.JulianDate());
        const t = i / duration; 

        const currentPos = Cesium.Cartesian3.lerp(launchPos, targetPos, t, new Cesium.Cartesian3());
        const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
        const h = 4 * maxHeight * t * (1 - t);
        const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
        
        threatPosProp.addSample(time, point);

        if (!activeBattery) {
            const distToNationalAirspace = Cesium.Cartesian3.distance(point, nationalCenterPos);
            
            if (distToNationalAirspace < nationalRadius) {
                let minDistance = Infinity;
                let closestBattery = null;

                defenseBatteries.forEach(battery => {
                    const bPos = Cesium.Cartesian3.fromDegrees(battery.lon, battery.lat, 0);
                    const distToBattery = Cesium.Cartesian3.distance(point, bPos);
                    
                    if (distToBattery < minDistance) {
                        minDistance = distToBattery;
                        closestBattery = battery;
                    }
                });

                activeBattery = closestBattery;
                interceptSecond = i + 15; 
                interceptTime = Cesium.JulianDate.addSeconds(startTime, interceptSecond, new Cesium.JulianDate());
                
                document.getElementById('entry-info').innerText = `Sınıra Giriş: T+ ${i} sn`;
                document.getElementById('status-msg').innerText = `ONAY: ${activeBattery.name.toUpperCase()} ATEŞLENDİ!`;
                document.getElementById('status-msg').style.color = "#ff4d4d";
            }
        }

        if (activeBattery && i === interceptSecond) {
            interceptPoint = point;
            document.getElementById('intercept-info').innerText = `İmha Koor: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(3)}, ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(3)}`;
        }
        
        if (interceptTime && Cesium.JulianDate.compare(time, interceptTime) >= 0) break;
    }

    // TEHDİT FÜZESİ
    viewer.entities.add({
        position: threatPosProp,
        point: { pixelSize: 8, color: Cesium.Color.RED },
        path: { width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.ORANGE }) },
        availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
            start: startTime,
            stop: interceptTime || Cesium.JulianDate.addSeconds(startTime, duration, new Cesium.JulianDate())
        })]) 
    });

    // SAVUNMA FÜZESİ VE PATLAMA
    if (activeBattery && interceptPoint) {
        const defensePosProp = new Cesium.SampledPositionProperty();
        const bPos = Cesium.Cartesian3.fromDegrees(activeBattery.lon, activeBattery.lat, 0);
        
        const launchTime = Cesium.JulianDate.addSeconds(startTime, interceptSecond - 13, new Cesium.JulianDate());
        const defFlightDuration = Cesium.JulianDate.secondsDifference(interceptTime, launchTime);

        for(let j = 0; j <= defFlightDuration; j++) {
            const time = Cesium.JulianDate.addSeconds(launchTime, j, new Cesium.JulianDate());
            const t = j / defFlightDuration;
            const currentPos = Cesium.Cartesian3.lerp(bPos, interceptPoint, t, new Cesium.Cartesian3());
            
            const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
            const targetHeight = Cesium.Cartographic.fromCartesian(interceptPoint).height;
            const h = 4 * 30000 * t * (1 - t) + (targetHeight * t); 
            const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
            
            defensePosProp.addSample(time, point);
        }

        viewer.entities.add({
            position: defensePosProp,
            point: { pixelSize: 6, color: Cesium.Color.LIME },
            path: { width: 2, material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN }) },
            availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start: launchTime, stop: interceptTime })])
        });

        viewer.entities.add({
            position: interceptPoint,
            point: {
                pixelSize: new Cesium.CallbackProperty((time) => {
                    const diff = Cesium.JulianDate.secondsDifference(time, interceptTime);
                    if (diff >= 0 && diff < 3.0) return 20 + (diff * 120); 
                    return 0; 
                }, false),
                color: new Cesium.CallbackProperty((time) => {
                    const diff = Cesium.JulianDate.secondsDifference(time, interceptTime);
                    if (diff >= 0 && diff < 3.0) return Cesium.Color.ORANGE.withAlpha(1.0 - (diff / 3.0)); 
                    return Cesium.Color.TRANSPARENT;
                }, false),
                outlineColor: Cesium.Color.RED,
                outlineWidth: 2
            }
        });
    }

    viewer.clock.currentTime = startTime; 
    viewer.flyTo(viewer.entities);
});