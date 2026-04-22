Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
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

// DÜNYA KAPLAMASI (ARCGIS UYDU GÖRÜNTÜLERİ)
viewer.imageryLayers.removeAll();
Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', {
        maximumLevel: 13
    }
).then(provider => viewer.imageryLayers.addImageryProvider(provider))
 .catch(error => console.error("Harita yüklenemedi:", error));

// --- AEGIS AĞI: STRATEJİK BATARYA KONUMLARI ---
const defenseBatteries = [
    { name: "Aegis-İstanbul", lat: 41.008, lon: 28.978 },
    { name: "Aegis-Ankara", lat: 39.933, lon: 32.859 },
    { name: "Aegis-Erzurum", lat: 39.904, lon: 41.267 },
    { name: "Aegis-Hatay", lat: 36.202, lon: 36.160 },
    { name: "Aegis-İzmir", lat: 38.419, lon: 27.128 }
];

const domeRadius = 250000.0; // Ağdaki her bataryanın 250 km radar/koruma çapı var

// Başlangıç Kamerası
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(35.2433, 38.9637, 3000000.0), // Tüm ağı görmek için biraz daha yüksekten bakıyoruz
    duration: 2
});

// --- SİMÜLASYON BAŞLATMA ---
document.getElementById('start-btn').addEventListener('click', () => {
    // Sol panelden girilen verileri al (Savunma kısmı artık hedefi temsil ediyor)
    const targetLat = parseFloat(document.getElementById('def-lat').value);
    const targetLon = parseFloat(document.getElementById('def-lon').value);
    const threatLat = parseFloat(document.getElementById('threat-lat').value);
    const threatLon = parseFloat(document.getElementById('threat-lon').value);

    // Ekranı ve arayüzü temizle
    viewer.entities.removeAll();
    document.getElementById('results').style.display = 'block';
    document.getElementById('entry-info').innerText = `Tespit: --:--`;
    document.getElementById('intercept-info').innerText = `İmha Konumu: --, --`;
    document.getElementById('status-msg').innerText = "RADAR: TEHDİT BEKLENİYOR...";
    document.getElementById('status-msg').style.color = "#ffeb3b";

    const targetPos = Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 0);
    const launchPos = Cesium.Cartesian3.fromDegrees(threatLon, threatLat, 0);

    // 1. Tüm Aegis Bataryalarını ve Kubbelerini Haritaya Çiz
    defenseBatteries.forEach(battery => {
        const bPos = Cesium.Cartesian3.fromDegrees(battery.lon, battery.lat, 0);
        viewer.entities.add({
            name: battery.name,
            position: bPos,
            point: { pixelSize: 8, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
            label: { text: battery.name, font: '10pt monospace', pixelOffset: new Cesium.Cartesian2(0, 15), fillColor: Cesium.Color.CYAN },
            ellipsoid: {
                radii: new Cesium.Cartesian3(domeRadius, domeRadius, domeRadius),
                maximumCone: Cesium.Math.PI_OVER_TWO,
                material: Cesium.Color.CYAN.withAlpha(0.08),
                outline: true, outlineColor: Cesium.Color.CYAN.withAlpha(0.2)
            }
        });
    });

    // Zaman ve Süre Ayarları
    const duration = 180; // Roketin hedefe uçuş süresi
    const startTime = viewer.clock.currentTime;
    const maxHeight = 150000; // 150km tepe noktası

    const threatPosProp = new Cesium.SampledPositionProperty();
    let activeBattery = null;
    let interceptPoint = null;
    let interceptTime = null;
    let interceptSecond = 0;

    // --- TEHDİT YÖRÜNGESİ VE YAKINLIK (PROXIMITY) KONTROLÜ ---
    for (let i = 0; i <= duration; i++) {
        const time = Cesium.JulianDate.addSeconds(startTime, i, new Cesium.JulianDate());
        const t = i / duration; 

        // Roketin parabolik konumunu hesapla
        const currentPos = Cesium.Cartesian3.lerp(launchPos, targetPos, t, new Cesium.Cartesian3());
        const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
        const h = 4 * maxHeight * t * (1 - t);
        const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
        
        threatPosProp.addSample(time, point);

        // Sisteme henüz bir batarya kilitlenmediyse radar kontrolü yap
        if (!activeBattery) {
            defenseBatteries.forEach(battery => {
                const bPos = Cesium.Cartesian3.fromDegrees(battery.lon, battery.lat, 0);
                const distance = Cesium.Cartesian3.distance(point, bPos);
                
                // Eğer roket herhangi bir bataryanın menziline girdiyse!
                if (distance < domeRadius) {
                    activeBattery = battery;
                    // Tespit edildikten 15 saniye sonra vurulacağını hesapla
                    interceptSecond = i + 15; 
                    interceptTime = Cesium.JulianDate.addSeconds(startTime, interceptSecond, new Cesium.JulianDate());
                    
                    // Arayüzü Güncelle
                    document.getElementById('entry-info').innerText = `Tespit: T+ ${i} sn`;
                    document.getElementById('status-msg').innerText = `AEGIS AĞI: ${battery.name.toUpperCase()} ATEŞLENDİ!`;
                    document.getElementById('status-msg').style.color = "#ff4d4d";
                }
            });
        }

        // Roketin vurulacağı saniyedeki koordinatını kaydet
        if (activeBattery && i === interceptSecond) {
            interceptPoint = point;
            document.getElementById('intercept-info').innerText = `İmha Koor: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(3)}, ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(3)}`;
        }
        
        // Roket vurulduysa yörüngeyi daha fazla çizmene gerek yok (Döngüden çık)
        if (interceptTime && Cesium.JulianDate.compare(time, interceptTime) >= 0) {
            break;
        }
    }

    // --- OBJE ÇİZİMLERİ ---

    // Tehdit Füzesi (Kırmızı) - Sadece vurulana kadar görünür
    viewer.entities.add({
        position: threatPosProp,
        point: { pixelSize: 8, color: Cesium.Color.RED },
        path: { width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.ORANGE }) },
        availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
            start: startTime,
            stop: interceptTime || Cesium.JulianDate.addSeconds(startTime, duration, new Cesium.JulianDate())
        })]) 
    });

    // Eğer roket tespit edildiyse Savunma Füzesini ve Patlamayı Çiz
    if (activeBattery && interceptPoint) {
        const defensePosProp = new Cesium.SampledPositionProperty();
        const bPos = Cesium.Cartesian3.fromDegrees(activeBattery.lon, activeBattery.lat, 0);
        
        // Önleyici füze tespit edildikten hemen sonra (örn 2 sn sonra) kalksın
        const launchTime = Cesium.JulianDate.addSeconds(startTime, interceptSecond - 13, new Cesium.JulianDate());
        const defFlightDuration = Cesium.JulianDate.secondsDifference(interceptTime, launchTime);

        // Önleyici füze yörüngesi
        for(let j = 0; j <= defFlightDuration; j++) {
            const time = Cesium.JulianDate.addSeconds(launchTime, j, new Cesium.JulianDate());
            const t = j / defFlightDuration;
            const currentPos = Cesium.Cartesian3.lerp(bPos, interceptPoint, t, new Cesium.Cartesian3());
            
            // Önleyici füze için daha düşük bir kavis
            const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
            const targetHeight = Cesium.Cartographic.fromCartesian(interceptPoint).height;
            const h = 4 * 30000 * t * (1 - t) + (targetHeight * t); 
            const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
            
            defensePosProp.addSample(time, point);
        }

        // Önleyici Füze Objesi (Yeşil)
        viewer.entities.add({
            position: defensePosProp,
            point: { pixelSize: 6, color: Cesium.Color.LIME },
            path: { width: 2, material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN }) },
            availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
                start: launchTime,
                stop: interceptTime // Patlama anında silinir
            })])
        });

        // HAVADA PATLAMA EFEKTİ (Dinamik Genişleyen Küre)
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
    } else {
        document.getElementById('status-msg').innerText = "HATA: TEHDİT AĞI AŞTI!";
        document.getElementById('status-msg').style.color = "red";
    }

    // Animasyonu başlat
    viewer.clock.currentTime = startTime; 
    viewer.flyTo(viewer.entities);
});