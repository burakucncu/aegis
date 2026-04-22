// Cesium.Ion.defaultAccessToken = 'SENIN_TOKENIN';
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: async () => await Cesium.createWorldTerrainAsync(),
    baseLayerPicker: false,
    timeline: true, 
    animation: true,
    skyAtmosphere: false // İsteğin üzerine atmosfer kapalı
});

// Gece gündüz döngüsü (güneş ışığı) aktif
viewer.scene.globe.enableLighting = true;

// İleride UI'dan atmosferi açıp kapatmak için kullanacağımız referans
let isAtmosphereOn = false;