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

// Başlangıç Kamerası
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(35.2433, 38.9637, 2500000.0),
    duration: 2
});

// --- AEGIS SİMÜLASYON MATEMATİĞİ VE ANİMASYONU ---
document.getElementById('start-btn').addEventListener('click', () => {
    const defLat = parseFloat(document.getElementById('def-lat').value);
    const defLon = parseFloat(document.getElementById('def-lon').value);
    const threatLat = parseFloat(document.getElementById('threat-lat').value);
    const threatLon = parseFloat(document.getElementById('threat-lon').value);

    // Yeni simülasyonda ekranı temizle
    viewer.entities.removeAll();
    document.getElementById('results').style.display = 'block';

    const domeRadius = 100000.0; // 100km Koruma Sahası
    const defensePos = Cesium.Cartesian3.fromDegrees(defLon, defLat, 0);
    const launchPos = Cesium.Cartesian3.fromDegrees(threatLon, threatLat, 0);

    // 1. AEGIS Savunma Merkezi ve Koruma Kubbesi
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

    // 2. Zaman Çizelgesi Ayarları
    const duration = 120; // Tehdidin toplam uçuş süresi (saniye)
    const startTime = viewer.clock.currentTime;
    
    // Kesişim (İmha) Anı Hesaplamaları
    const interceptRatio = 0.85; // Tehdit yolun %85'indeyken imha edilecek
    const interceptTime = Cesium.JulianDate.addSeconds(startTime, duration * interceptRatio, new Cesium.JulianDate());
    
    // Savunma füzesinin kalkış anı
    const defenseLaunchTime = Cesium.JulianDate.addSeconds(startTime, duration * 0.60, new Cesium.JulianDate()); 

    const threatPosProp = new Cesium.SampledPositionProperty();
    const defensePosProp = new Cesium.SampledPositionProperty();
    const maxHeight = 150000; // 150km tepe noktası (Uzay sınırı)
    let interceptPoint = null;

    // Arayüzü Sıfırla
    document.getElementById('entry-info').innerText = `Hava sahasına giriş: --:--`;
    document.getElementById('intercept-info').innerText = `İmha Konumu: --, --`;
    document.getElementById('status-msg').innerText = "RADAR: TEHDİT İZLENİYOR...";
    document.getElementById('status-msg').style.color = "#ffeb3b"; // Sarı uyarı

    // --- TEHDİT ROKETİ YÖRÜNGESİ ---
    for (let i = 0; i <= duration * interceptRatio; i += 1) {
        const time = Cesium.JulianDate.addSeconds(startTime, i, new Cesium.JulianDate());
        const t = i / duration; 

        const currentPos = Cesium.Cartesian3.lerp(launchPos, defensePos, t, new Cesium.Cartesian3());
        const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
        
        const h = 4 * maxHeight * t * (1 - t);
        const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
        
        threatPosProp.addSample(time, point);

        // Son koordinatı kesişim (patlama) noktası olarak kaydet
        if (i === Math.floor(duration * interceptRatio)) {
            interceptPoint = point; 
        }

        // Hava sahası giriş kontrolü ve arayüz güncellemesi
        const dist = Cesium.Cartesian3.distance(point, defensePos);
        if (dist < domeRadius && document.getElementById('entry-info').innerText.includes('--')) {
            document.getElementById('entry-info').innerText = `Hava sahasına giriş: T+ ${i} sn`;
            document.getElementById('intercept-info').innerText = `İmha Koor: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(3)}, ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(3)}`;
            document.getElementById('status-msg').innerText = "AEGIS: ÖNLEYİCİ FÜZE ATEŞLENDİ!";
            document.getElementById('status-msg').style.color = "#ff4d4d"; // Kırmızı alarm
        }
    }

    // --- AEGIS SAVUNMA FÜZESİ YÖRÜNGESİ ---
    const defDuration = Cesium.JulianDate.secondsDifference(interceptTime, defenseLaunchTime);
    defensePosProp.addSample(defenseLaunchTime, defensePos); // Fırlatma rampasından başla
    
    for(let i = 1; i <= defDuration; i++) {
        const time = Cesium.JulianDate.addSeconds(defenseLaunchTime, i, new Cesium.JulianDate());
        const t = i / defDuration;
        
        const currentPos = Cesium.Cartesian3.lerp(defensePos, interceptPoint, t, new Cesium.Cartesian3());
        const cartographic = Cesium.Cartographic.fromCartesian(currentPos);
        
        // Önleyici füze agresif ve direkt bir açıyla kalkar (daha düşük parabol)
        const targetHeight = Cesium.Cartographic.fromCartesian(interceptPoint).height;
        const h = 4 * 20000 * t * (1 - t) + (targetHeight * t); 
        const point = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, h);
        
        defensePosProp.addSample(time, point);
    }

    // --- OBJE ÇİZİMLERİ ---

    // 1. Tehdit Füzesi (Kırmızı)
    viewer.entities.add({
        position: threatPosProp,
        point: { pixelSize: 8, color: Cesium.Color.RED },
        path: { width: 3, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.ORANGE }) },
        availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
            start: startTime,
            stop: interceptTime // Patlama anında silinir
        })]) 
    });

    // 2. Aegis Önleyici Füze (Yeşil/Mavi)
    viewer.entities.add({
        position: defensePosProp,
        point: { pixelSize: 6, color: Cesium.Color.LIME },
        path: { width: 2, material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN }) },
        availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
            start: defenseLaunchTime,
            stop: interceptTime // Patlama anında silinir
        })])
    });

    // 3. HAVADA PATLAMA EFEKTİ (Dinamik Genişleyen Küre)
    viewer.entities.add({
        position: interceptPoint,
        point: {
            // Zaman farkına (diff) göre boyutu saniyeler içinde hızla büyütür
            pixelSize: new Cesium.CallbackProperty((time) => {
                const diff = Cesium.JulianDate.secondsDifference(time, interceptTime);
                if (diff >= 0 && diff < 2.5) { 
                    return 20 + (diff * 100); // Küçük başlayıp devasa bir ateş topuna dönüşür
                }
                return 0; // Zamanı gelmeden önce veya bittikten sonra görünmez
            }, false),
            // Yine zamana göre şeffaflaşarak duman gibi dağılır
            color: new Cesium.CallbackProperty((time) => {
                const diff = Cesium.JulianDate.secondsDifference(time, interceptTime);
                if (diff >= 0 && diff < 2.5) {
                    return Cesium.Color.ORANGE.withAlpha(1.0 - (diff / 2.5)); 
                }
                return Cesium.Color.TRANSPARENT;
            }, false),
            outlineColor: Cesium.Color.RED,
            outlineWidth: 2
        }
    });

    // Simülasyonu başlat ve kamerayı sahneye odakla
    viewer.clock.currentTime = startTime; 
    viewer.flyTo(viewer.entities);
});