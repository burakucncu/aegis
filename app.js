Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    // DÜNYANIN KAYBOLMASINI ÇÖZEN YENİ TERRAIN KODU BURASI:
    terrain: Cesium.Terrain.fromWorldTerrain(),
    shouldAnimate: true,
    animation: true,
    timeline: true,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: true, 
    infoBox: false,
    navigationHelpButton: false,
    skyAtmosphere: false
});

// Görüntü Kalitesi Ayarları
viewer.scene.globe.maximumScreenSpaceError = 2;
viewer.resolutionScale = 1.0;
viewer.scene.postProcessStages.fxaa.enabled = true;
viewer.scene.globe.enableLighting = true;

// DÜNYA KAPLAMASI (ARCGIS UYDU GÖRÜNTÜLERİ) ESKİ PROJENDEKİ GİBİ GARANTİLİ YÖNTEM
viewer.imageryLayers.removeAll();
Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', {
        maximumLevel: 13
    }
).then(function(provider) {
    viewer.imageryLayers.addImageryProvider(provider);
}).catch(function(error) { 
    console.error("Harita yüklenemedi:", error); 
});

// Başlangıç Kamerası (Türkiye üzerine uçuş)
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(35.2433, 38.9637, 2500000.0),
    duration: 2
});

// --- SİMÜLASYON BAŞLATMA VE FİZİK MATEMATİĞİ ---
document.getElementById('start-btn').addEventListener('click', () => {
    const defLat = parseFloat(document.getElementById('def-lat').value);
    const defLon = parseFloat(document.getElementById('def-lon').value);
    const threatLat = parseFloat(document.getElementById('threat-lat').value);
    const threatLon = parseFloat(document.getElementById('threat-lon').value);

    viewer.entities.removeAll();
    document.getElementById('results').style.display = 'block';

    const domeRadius = 100000.0; // 100km Koruma Sahası
    const defensePos = Cesium.Cartesian3.fromDegrees(defLon, defLat, 0);
    const launchPos = Cesium.Cartesian3.fromDegrees(threatLon, threatLat, 0);

    // 1. Savunma Merkezi ve Kubbe
    viewer.entities.add({
        position: defensePos,
        point: { pixelSize: 10, color: Cesium.Color.CYAN },
        ellipsoid: {
            radii: new Cesium.Cartesian3(domeRadius, domeRadius, domeRadius),
            maximumCone: Cesium.Math.PI_OVER_TWO,
            material: Cesium.Color.CYAN.withAlpha(0.1),
            outline: true, outlineColor: Cesium.Color.CYAN.withAlpha(0.3)
        }
    });

    // 2. Roket Yörüngesi Hesaplama (Parabolik)
    const startTime = viewer.clock.currentTime;
    const duration = 120; // Roketin uçuş süresi (saniye)
    const stopTime = Cesium.JulianDate.addSeconds(startTime, duration, new Cesium.JulianDate());

    const positionProperty = new Cesium.SampledPositionProperty();
    const maxHeight = 150000; // 150km tepe noktası

    // Eski sonuçları sıfırla
    document.getElementById('entry-info').innerText = `Hava sahasına giriş: --:--`;
    document.getElementById('intercept-info').innerText = `Konum: --, --`;
    document.getElementById('status-msg').innerText = "SİMÜLASYON İZLENİYOR...";
    document.getElementById('status-msg').style.color = "yellow";

    for (let i = 0; i <= duration; i += 1) {
        const time = Cesium.JulianDate.addSeconds(startTime, i, new Cesium.JulianDate());
        const t = i / duration; 

        // Geometrik interpolasyon (Yer küre eğriliği dahil)
        const currentPos = Cesium.Cartesian3.lerp(launchPos, defensePos, t, new Cesium.Cartesian3());
        const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
        
        // Parabol denklemi: h = 4 * Hmax * t * (1-t)
        const h = 4 * maxHeight * t * (1 - t);
        const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
        
        positionProperty.addSample(time, point);

        // Hava sahasına giriş kontrolü (Mesafe < domeRadius)
        const dist = Cesium.Cartesian3.distance(point, defensePos);
        if (dist < domeRadius && document.getElementById('entry-info').innerText.includes('--')) {
            document.getElementById('entry-info').innerText = `Hava sahasına giriş: ${i}. saniye`;
            document.getElementById('intercept-info').innerText = `Konum: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(3)}, ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(3)}`;
            document.getElementById('status-msg').innerText = "KRİTİK: TEHDİT ALGILANDI!";
            document.getElementById('status-msg').style.color = "#ff4d4d";
        }
    }

    // 3. Roket Entity
    const rocket = viewer.entities.add({
        position: positionProperty,
        point: { pixelSize: 8, color: Cesium.Color.RED },
        path: { width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.YELLOW }) }
    });

    viewer.flyTo(viewer.entities);
});