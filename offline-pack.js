(() => {
  'use strict';

  const DB_NAME = 'kamakura-offline-pack-v39';
  const DB_VERSION = 1;
  const STORE_NAME = 'packs';
  const PACK_ID = 'kamakura-city-v39';
  const BOUNDS = [[35.2760, 139.4860], [35.3650, 139.5940]];
  const CENTER = [35.3200, 139.5400];

  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  const SHELTER_LAYERS = [
    { id: 'sih', hazards: ['none'], category: '指定避難所' },
    { id: 'skhb01', hazards: ['flood'], category: '指定緊急避難場所・洪水' },
    { id: 'skhb02', hazards: ['landslide'], category: '指定緊急避難場所・土砂災害' },
    { id: 'skhb03', hazards: ['hightide'], category: '指定緊急避難場所・高潮' },
    { id: 'skhb05', hazards: ['tsunami'], category: '指定緊急避難場所・津波' },
    { id: 'skhb07', hazards: ['inland'], category: '指定緊急避難場所・内水' }
  ];

  const HAZARD_TEMPLATES = [
    'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
    'https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png'
  ];

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function load() {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PACK_ID);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  }

  async function save(data) {
    const db = await openDb();
    if (!db) throw new Error('IndexedDBを利用できません。');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: PACK_ID, data });
      tx.oncomplete = () => resolve(data);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear() {
    const db = await openDb();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(PACK_ID);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }
    if ('caches' in window) {
      await caches.delete('kamakura-disaster-runtime-tiles-v39');
    }
  }

  function haversine(a, b) {
    const r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r;
    const dLng = (b[1] - a[1]) * r;
    const lat1 = a[0] * r;
    const lat2 = b[0] * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(h));
  }

  function roadClass(highway) {
    if (['primary', 'primary_link'].includes(highway)) return 'primary';
    if (['secondary', 'secondary_link', 'tertiary', 'tertiary_link'].includes(highway)) return 'secondary';
    if (['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(highway)) return 'footway';
    return 'residential';
  }

  function walkable(tags) {
    const highway = tags?.highway || '';
    if (!highway) return false;
    if (['motorway', 'motorway_link', 'construction', 'proposed', 'raceway'].includes(highway)) return false;
    if (['private', 'no'].includes(tags?.access)) return false;
    if (tags?.foot === 'no') return false;
    return true;
  }

  function simplifyCoords(coords, thresholdMeters) {
    if (!Array.isArray(coords) || coords.length <= 2) return coords || [];
    const out = [coords[0]];
    let last = coords[0];
    for (let i = 1; i < coords.length - 1; i += 1) {
      if (haversine(last, coords[i]) >= thresholdMeters) {
        out.push(coords[i]);
        last = coords[i];
      }
    }
    out.push(coords[coords.length - 1]);
    return out;
  }

  function normalizeRoadWays(elements) {
    const seen = new Set();
    const roads = [];
    const graphNodes = new Map();
    const graphEdges = [];
    const context = { railways: [], waterways: [], places: [] };

    for (const element of elements) {
      if (!element || seen.has(`${element.type}:${element.id}`)) continue;
      seen.add(`${element.type}:${element.id}`);

      if (element.type === 'node' && element.tags?.place && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        const name = element.tags['name:ja'] || element.tags.name;
        if (name) context.places.push({ name, position: [element.lat, element.lon], type: element.tags.place });
        continue;
      }

      if (element.type !== 'way' || !Array.isArray(element.geometry) || element.geometry.length < 2) continue;
      const coords = element.geometry.map((point) => [point.lat, point.lon]);

      if (element.tags?.railway) {
        context.railways.push({ coords: simplifyCoords(coords, 18), name: element.tags['name:ja'] || element.tags.name || '' });
        continue;
      }

      if (element.tags?.waterway) {
        context.waterways.push({ coords: simplifyCoords(coords, 14), name: element.tags['name:ja'] || element.tags.name || '' });
        continue;
      }

      if (!walkable(element.tags)) continue;

      const highway = element.tags.highway;
      const cls = roadClass(highway);
      const threshold = cls === 'primary' ? 7 : cls === 'secondary' ? 9 : cls === 'footway' ? 13 : 11;
      const name = element.tags['name:ja'] || element.tags.name || '';
      roads.push({
        id: String(element.id),
        name,
        roadClass: cls,
        highway,
        coords: simplifyCoords(coords, threshold)
      });

      if (!Array.isArray(element.nodes) || element.nodes.length !== element.geometry.length) continue;
      for (let i = 0; i < element.nodes.length; i += 1) {
        const nodeId = String(element.nodes[i]);
        const point = element.geometry[i];
        if (!graphNodes.has(nodeId)) graphNodes.set(nodeId, [nodeId, point.lat, point.lon]);
        if (i === 0) continue;
        const prevId = String(element.nodes[i - 1]);
        const prevPoint = element.geometry[i - 1];
        const distance = haversine([prevPoint.lat, prevPoint.lon], [point.lat, point.lon]);
        if (!Number.isFinite(distance) || distance <= 0 || distance > 1000) continue;
        graphEdges.push([prevId, nodeId, Math.round(distance * 10) / 10, cls, name, highway]);
      }
    }

    return {
      roads,
      graph: { nodes: Array.from(graphNodes.values()), edges: graphEdges },
      context
    };
  }

  function areaQuery() {
    return `[out:json][timeout:120];area["name"="鎌倉市"]["boundary"="administrative"]->.a;(way(area.a)["highway"];way(area.a)["railway"];way(area.a)["waterway"];node(area.a)["place"];);out body geom;`;
  }

  function bboxQuery(bounds) {
    const [south, west, north, east] = bounds;
    return `[out:json][timeout:90];(way["highway"](${south},${west},${north},${east});way["railway"](${south},${west},${north},${east});way["waterway"](${south},${west},${north},${east});node["place"](${south},${west},${north},${east}););out body geom;`;
  }

  async function overpassFetch(query) {
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ data: query }).toString()
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!Array.isArray(json.elements)) throw new Error('道路データ形式が不正です。');
        return json.elements;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('道路データを取得できません。');
  }

  function splitBounds(rows = 3, cols = 3) {
    const south = BOUNDS[0][0];
    const west = BOUNDS[0][1];
    const north = BOUNDS[1][0];
    const east = BOUNDS[1][1];
    const dLat = (north - south) / rows;
    const dLng = (east - west) / cols;
    const list = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        list.push([
          south + dLat * r,
          west + dLng * c,
          south + dLat * (r + 1),
          west + dLng * (c + 1)
        ]);
      }
    }
    return list;
  }

  async function fetchRoadNetwork(progress) {
    progress(5, '鎌倉市の道路ネットワークを取得しています');
    try {
      const elements = await overpassFetch(areaQuery());
      if (elements.length > 100) return normalizeRoadWays(elements);
    } catch (_) {}

    const all = [];
    const parts = splitBounds();
    for (let i = 0; i < parts.length; i += 1) {
      progress(7 + Math.round((i / parts.length) * 38), `道路データ ${i + 1}/${parts.length}`);
      const elements = await overpassFetch(bboxQuery(parts[i]));
      all.push(...elements);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return normalizeRoadWays(all);
  }

  function lonToTileX(lon, zoom) {
    return Math.floor((lon + 180) / 360 * 2 ** zoom);
  }

  function latToTileY(lat, zoom) {
    const rad = lat * Math.PI / 180;
    return Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** zoom);
  }

  function tileListForBounds(zoom) {
    const xMin = lonToTileX(BOUNDS[0][1], zoom);
    const xMax = lonToTileX(BOUNDS[1][1], zoom);
    const yMin = latToTileY(BOUNDS[1][0], zoom);
    const yMax = latToTileY(BOUNDS[0][0], zoom);
    const out = [];
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) out.push({ z: zoom, x, y });
    }
    return out;
  }

  function featureName(properties) {
    if (!properties) return '';
    const candidates = [
      properties.name,
      properties.Name,
      properties.NAME,
      properties['名称'],
      properties['施設名'],
      properties['指定緊急避難場所'],
      properties['指定避難所'],
      properties['name:ja'],
      properties.facility_name
    ];
    return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
  }

  function featureAddress(properties) {
    if (!properties) return '';
    const candidates = [
      properties.address,
      properties.Address,
      properties['住所'],
      properties['所在地'],
      properties['所在地_連結表記']
    ];
    return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
  }

  async function fetchShelters(progress) {
    progress(47, '避難所・津波避難場所を保存しています');
    const tiles = tileListForBounds(10);
    const merged = new Map();

    for (let layerIndex = 0; layerIndex < SHELTER_LAYERS.length; layerIndex += 1) {
      const layer = SHELTER_LAYERS[layerIndex];
      for (const tile of tiles) {
        const url = `https://cyberjapandata.gsi.go.jp/xyz/${layer.id}/${tile.z}/${tile.x}/${tile.y}.geojson`;
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) continue;
          const data = await response.json();
          for (const feature of data.features || []) {
            if (feature?.geometry?.type !== 'Point') continue;
            const [lng, lat] = feature.geometry.coordinates || [];
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            if (lat < BOUNDS[0][0] || lat > BOUNDS[1][0] || lng < BOUNDS[0][1] || lng > BOUNDS[1][1]) continue;
            const name = featureName(feature.properties);
            if (!name) continue;
            const key = `${name}:${lat.toFixed(5)},${lng.toFixed(5)}`;
            const current = merged.get(key) || {
              id: `gsi-${Math.abs(hashString(key))}`,
              name,
              position: [lat, lng],
              category: layer.category,
              address: featureAddress(feature.properties),
              hazards: ['none'],
              source: '国土地理院 指定緊急避難場所・指定避難所'
            };
            current.hazards = Array.from(new Set([...current.hazards, ...layer.hazards]));
            if (layer.id !== 'sih') current.category = layer.category;
            merged.set(key, current);
          }
        } catch (_) {}
      }
      progress(47 + Math.round(((layerIndex + 1) / SHELTER_LAYERS.length) * 8), `避難所データ ${layerIndex + 1}/${SHELTER_LAYERS.length}`);
    }

    return Array.from(merged.values());
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return hash;
  }

  async function cacheHazardTiles(progress) {
    if (!('caches' in window)) return 0;
    const cache = await caches.open('kamakura-disaster-runtime-tiles-v39');
    const tiles = [12, 13, 14].flatMap(tileListForBounds);
    const urls = [];
    for (const template of HAZARD_TEMPLATES) {
      for (const tile of tiles) {
        urls.push(template.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y));
      }
    }

    let saved = 0;
    const concurrency = 7;
    let cursor = 0;

    async function worker() {
      while (cursor < urls.length) {
        const index = cursor;
        cursor += 1;
        const url = urls[index];
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const response = await fetch(url, { mode: 'no-cors', cache: 'reload' });
            await cache.put(url, response);
          }
          saved += 1;
        } catch (_) {}
        if (index % 20 === 0 || index === urls.length - 1) {
          progress(57 + Math.round((index / Math.max(1, urls.length - 1)) * 31), `危険区域タイル ${Math.min(index + 1, urls.length)}/${urls.length}`);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return saved;
  }

  function routingHazards() {
    return {
      tsunami: [
        { name: '腰越・七里ガ浜沿岸', color: '#8f6ac8', coords: [[35.290,139.486],[35.290,139.522],[35.313,139.522],[35.314,139.501],[35.313,139.486]] },
        { name: '稲村ガ崎・由比ガ浜・材木座沿岸', color: '#8f6ac8', coords: [[35.296,139.518],[35.296,139.568],[35.314,139.568],[35.315,139.551],[35.314,139.534],[35.312,139.518]] }
      ],
      flood: [
        { name: '柏尾川周辺', color: '#4a90e2', coords: [[35.327,139.526],[35.327,139.540],[35.365,139.540],[35.365,139.526]] },
        { name: '滑川周辺', color: '#4a90e2', coords: [[35.304,139.549],[35.304,139.561],[35.331,139.568],[35.331,139.558]] }
      ],
      inland: [
        { name: '鎌倉低地', color: '#5aa7d8', coords: [[35.305,139.540],[35.305,139.561],[35.322,139.561],[35.324,139.548],[35.315,139.540]] },
        { name: '大船低地', color: '#5aa7d8', coords: [[35.337,139.526],[35.337,139.548],[35.365,139.548],[35.365,139.526]] }
      ],
      hightide: [
        { name: '鎌倉市沿岸', color: '#7d9fd6', coords: [[35.289,139.486],[35.289,139.568],[35.307,139.568],[35.309,139.530],[35.309,139.486]] }
      ],
      landslide: [
        { name: '鎌倉西側丘陵', color: '#d68a3a', coords: [[35.307,139.500],[35.307,139.539],[35.355,139.528],[35.360,139.500]] },
        { name: '鎌倉東側丘陵', color: '#d68a3a', coords: [[35.316,139.557],[35.316,139.594],[35.355,139.594],[35.350,139.565]] }
      ]
    };
  }

  async function estimateStorage() {
    if (!navigator.storage?.estimate) return null;
    try {
      return await navigator.storage.estimate();
    } catch (_) {
      return null;
    }
  }

  async function install(progressCallback) {
    if (!navigator.onLine) throw new Error('初回の全域保存はオンライン時に実行してください。');
    const progress = typeof progressCallback === 'function' ? progressCallback : () => {};
    progress(1, '鎌倉市全域オフラインパックを開始します');

    const network = await fetchRoadNetwork(progress);
    const shelters = await fetchShelters(progress);
    const hazardTileCount = await cacheHazardTiles(progress);

    progress(90, '端末内データを保存しています');
    const baseFallback = window.KAMAKURA_OFFLINE || {};
    const pack = {
      version: 'v39',
      name: '鎌倉市全域オフラインパック',
      bounds: BOUNDS,
      center: CENTER,
      installedAt: Date.now(),
      roads: network.roads,
      graph: network.graph,
      context: network.context,
      shelters,
      hazards: routingHazards(),
      hazardTileCount,
      hasHazardTiles: hazardTileCount > 0,
      sources: [
        'OpenStreetMap contributors',
        '国土地理院 指定緊急避難場所・指定避難所',
        '国土地理院 ハザードマップポータルサイト'
      ],
      fallbackPreparePairs: baseFallback.preparePairs || []
    };

    await save(pack);
    const estimate = await estimateStorage();
    progress(100, '鎌倉市全域オフラインパックの保存が完了しました');
    return { pack, estimate };
  }

  window.KAMAKURA_OFFLINE_PACK = {
    bounds: BOUNDS,
    load,
    install,
    clear,
    estimateStorage
  };
})();
