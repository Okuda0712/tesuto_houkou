(() => {
  'use strict';

  const KAMAKURA_BOUNDS_COORDS = [[35.2760, 139.4860], [35.3650, 139.5940]];
  const DEMO_POSITIONS = {
    station: { lat: 35.3193, lng: 139.5504, label: '鎌倉駅周辺（デモ）' },
    coast: { lat: 35.3092, lng: 139.5464, label: '由比ヶ浜付近（デモ）' }
  };

  const LAST_POSITION_KEY = 'kamakura-evac:last-position:v1';
  const ROUTE_CACHE_KEY = 'kamakura-evac:route-cache:v13-safe-shortest';
  const HAZARD_SELECTION_KEY = 'kamakura-evac:hazards:v1';
  const MAX_SAVED_POSITION_AGE = 6 * 60 * 60 * 1000;
  const SHELTER_STATUS_KEY = 'kamakura-evac:shelter-status:v14';
  const REPORTS_KEY = 'kamakura-evac:reports:v14';
  const CONGESTION_KEY = 'kamakura-evac:congestion:v14';
  const TRANSPORT_KEY = 'kamakura-evac:transport:v14';
  const DB_NAME = 'kamakura-bosai-v14';
  const DB_VERSION = 1;

  const EVACUATION_CANDIDATES = [
    {
      id: 'genjiyama-park',
      name: { ja: '源氏山公園', en: 'Genjiyama Park', zh: '源氏山公园' },
      position: [35.32415, 139.53735],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 1,
      tsunamiPriority: 100,
      label: { ja: '海岸から離れた高台方面の有力候補', en: 'Priority higher-ground option away from the coast', zh: '远离海岸的高地优先候选地点' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'tsurugaoka-hachimangu',
      name: { ja: '鶴岡八幡宮', en: 'Tsurugaoka Hachimangu', zh: '鹤冈八幡宫' },
      position: [35.32595, 139.55635],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 2,
      tsunamiPriority: 95,
      label: { ja: '鎌倉駅周辺から北側へ向かう広域避難場所', en: 'Wide-area evacuation site north of Kamakura Station', zh: '从镰仓站周边向北前往的广域避难场所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'yokohama-national-kamakura',
      name: { ja: '横浜国大附属鎌倉小・中学校', en: 'Yokohama National University Kamakura School', zh: '横滨国立大学附属镰仓小学・中学' },
      position: [35.32725, 139.55985],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 3,
      tsunamiPriority: 92,
      label: { ja: '八幡宮北側の高台寄り避難候補', en: 'Evacuation option on the higher ground north of Hachimangu', zh: '八幡宫北侧高地附近的避难候选地点' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'daini-junior-high',
      name: { ja: '第二中学校', en: 'Daini Junior High School', zh: '第二中学' },
      position: [35.32945, 139.56285],
      type: 'safe-area',
      officialType: '指定避難所',
      source: '鎌倉市 指定避難所一覧',
      priority: 4,
      tsunamiPriority: 88,
      label: { ja: '西御門方面の指定避難所', en: 'Designated shelter in the Nishimikado area', zh: '西御门方向的指定避难所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide', 'landslide']
    },
    {
      id: 'daini-elementary',
      name: { ja: '第二小学校', en: 'Daini Elementary School', zh: '第二小学' },
      position: [35.33070, 139.56875],
      type: 'safe-area',
      officialType: '指定避難所',
      source: '鎌倉市 指定避難所一覧',
      priority: 5,
      tsunamiPriority: 86,
      label: { ja: '二階堂方面の指定避難所', en: 'Designated shelter in the Nikaido area', zh: '二阶堂方向的指定避难所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide', 'landslide']
    },
    {
      id: 'kamakura-reien',
      name: { ja: '鎌倉霊園', en: 'Kamakura Reien Cemetery', zh: '镰仓灵园' },
      position: [35.32785, 139.59210],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 6,
      tsunamiPriority: 80,
      label: { ja: '十二所方面の広域避難場所', en: 'Wide-area evacuation site in the Juniso area', zh: '十二所方向的广域避难场所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'onari-junior-high',
      name: { ja: '御成中学校', en: 'Onari Junior High School', zh: '御成中学' },
      position: [35.31685, 139.54595],
      type: 'safe-area',
      officialType: '指定避難所・広域避難場所',
      source: '鎌倉市 指定避難所一覧',
      priority: 7,
      tsunamiPriority: 55,
      label: { ja: '長谷・笹目町方面の指定避難所', en: 'Designated shelter around Hase and Sasamecho', zh: '长谷・笹目町方向的指定避难所' },
      hazards: ['none', 'flood', 'inland', 'landslide']
    },
    {
      id: 'onari-elementary',
      name: { ja: '御成小学校', en: 'Onari Elementary School', zh: '御成小学' },
      position: [35.31965, 139.54635],
      type: 'safe-area',
      officialType: '指定避難所',
      source: '鎌倉市 指定避難所一覧',
      priority: 8,
      tsunamiPriority: 58,
      label: { ja: '鎌倉駅西側の指定避難所', en: 'Designated shelter west of Kamakura Station', zh: '镰仓站西侧的指定避难所' },
      hazards: ['none', 'flood', 'inland', 'landslide']
    },
    {
      id: 'fueda-park',
      name: { ja: '笛田公園', en: 'Fueda Park', zh: '笛田公园' },
      position: [35.32485, 139.51585],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 9,
      tsunamiPriority: 76,
      label: { ja: '鎌倉山・笛田方面の広域避難場所', en: 'Wide-area evacuation site toward Kamakurayama and Fueda', zh: '镰仓山・笛田方向的广域避难场所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'kamakura-central-park',
      name: { ja: '鎌倉中央公園', en: 'Kamakura Chuo Park', zh: '镰仓中央公园' },
      position: [35.33190, 139.52880],
      type: 'high-ground',
      officialType: '広域避難場所',
      source: '鎌倉市 災害時の避難場所',
      priority: 10,
      tsunamiPriority: 78,
      label: { ja: '山崎方面の広域避難場所', en: 'Wide-area evacuation site in the Yamasaki area', zh: '山崎方向的广域避难场所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide']
    },
    {
      id: 'fukasawa-junior-high',
      name: { ja: '深沢中学校', en: 'Fukasawa Junior High School', zh: '深泽中学' },
      position: [35.32760, 139.51995],
      type: 'safe-area',
      officialType: '指定避難所・広域避難場所',
      source: '鎌倉市 指定避難所一覧',
      priority: 11,
      tsunamiPriority: 70,
      label: { ja: '梶原方面の指定避難所', en: 'Designated shelter in the Kajiwara area', zh: '梶原方向的指定避难所' },
      hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide', 'landslide']
    },
    {
      id: 'first-elementary',
      name: { ja: '第一小学校', en: 'Daiichi Elementary School', zh: '第一小学' },
      position: [35.31595, 139.55010],
      type: 'safe-area',
      officialType: '指定避難所',
      source: '鎌倉市 指定避難所一覧',
      priority: 12,
      tsunamiPriority: 30,
      label: { ja: '由比ガ浜方面の指定避難所。周辺状況を確認して利用する候補', en: 'Designated shelter around Yuigahama. Check local conditions before using this option.', zh: '由比滨方向的指定避难所。请确认周边情况后再使用该候选地点' },
      hazards: ['none', 'flood', 'inland', 'landslide']
    },
    {
      id: 'inamuragasaki-elementary',
      name: { ja: '稲村ケ崎小学校', en: 'Inamuragasaki Elementary School', zh: '稻村崎小学' },
      position: [35.30995, 139.52235],
      type: 'safe-area',
      officialType: '指定避難所',
      source: '鎌倉市 指定避難所一覧',
      priority: 13,
      tsunamiPriority: 28,
      label: { ja: '極楽寺方面の指定避難所。周辺状況を確認して利用する候補', en: 'Designated shelter around Gokurakuji. Check local conditions before using this option.', zh: '极乐寺方向的指定避难所。请确认周边情况后再使用该候选地点' },
      hazards: ['none', 'flood', 'inland', 'landslide']
    }
  ];


  const TSUNAMI_SAFE_POINTS = [
    { id: 'sp-kamakura-fire', name: '鎌倉消防署', category: '津波避難ビル', position: [35.31235, 139.55110], area: '由比ガ浜・材木座' },
    { id: 'sp-kamakura-police', name: '鎌倉警察署', category: '津波避難ビル', position: [35.31980, 139.55285], area: '小町・由比ガ浜' },
    { id: 'sp-kamakura-chokai', name: '鎌倉彫会館', category: '津波避難ビル', position: [35.31795, 139.55215], area: '小町' },
    { id: 'sp-hayami-art', name: '早見芸術学園1号館', category: '津波避難ビル', position: [35.31880, 139.55045], area: '御成町' },
    { id: 'sp-kny-building', name: 'KNビル', category: '津波避難ビル', position: [35.31930, 139.54885], area: '御成町' },
    { id: 'sp-kamiyodo-building', name: '鎌陽洞ビル', category: '津波避難ビル', position: [35.31735, 139.55020], area: '由比ガ浜' },
    { id: 'sp-kadoki-hall', name: 'カドキホール', category: '津波避難ビル', position: [35.32020, 139.54895], area: '御成町' },
    { id: 'sp-sakurai-building', name: '櫻井ビル', category: '津波避難ビル', position: [35.32090, 139.55130], area: '小町' },
    { id: 'sp-yuigahama-corpo-1', name: '由比ガ浜コーポ1号館', category: '津波避難ビル', position: [35.31340, 139.54825], area: '由比ガ浜' },
    { id: 'sp-yuigahama-corpo-2', name: '由比ガ浜コーポ2号館', category: '津波避難ビル', position: [35.31310, 139.54875], area: '由比ガ浜' },
    { id: 'sp-kamakura-park-hotel', name: '鎌倉パークホテル', category: '津波避難ビル', position: [35.30405, 139.52915], area: '坂ノ下' },
    { id: 'sp-hase-square', name: 'かまくら長谷スクエア', category: '津波避難ビル', position: [35.31255, 139.53410], area: '長谷' },
    { id: 'sp-diamond-society', name: 'ダイヤモンド鎌倉別邸ソサエティ', category: '津波避難ビル', position: [35.31215, 139.53605], area: '長谷' },
    { id: 'sp-kamakura-bungakukan', name: '鎌倉文学館', category: '津波避難空地・高台', position: [35.31420, 139.53640], area: '長谷' },
    { id: 'sp-hasedera', name: '長谷寺周辺高台', category: '高台', position: [35.31265, 139.53305], area: '長谷' },
    { id: 'sp-kosokuji', name: '光則寺周辺高台', category: '高台', position: [35.31365, 139.53170], area: '長谷' },
    { id: 'sp-yuigahama-open', name: '由比ガ浜西公園周辺高台方向', category: '避難空地', position: [35.31390, 139.54200], area: '由比ガ浜' },
    { id: 'sp-zaimokuza-open', name: '材木座海岸北側高台方向', category: '避難空地', position: [35.31090, 139.55840], area: '材木座' },
    { id: 'sp-koshigoe-es', name: '腰越小学校', category: '指定避難所・高台', position: [35.30970, 139.49380], area: '腰越' },
    { id: 'sp-koshigoe-chuo', name: '腰越中央医院周辺', category: '津波避難ビル', position: [35.31065, 139.49195], area: '腰越' },
    { id: 'sp-koyurugi-shrine', name: '小動神社', category: '高台', position: [35.30690, 139.48765], area: '腰越' },
    { id: 'sp-enoshima-view', name: '江ノ島ビューシティハウス周辺', category: '津波避難ビル', position: [35.30790, 139.49120], area: '腰越' },
    { id: 'sp-kamakura-high-school', name: '県立鎌倉高等学校', category: '広域避難場所・高台', position: [35.30695, 139.50280], area: '七里ガ浜' },
    { id: 'sp-shichirigahama-es', name: '七里ガ浜小学校', category: '指定避難所・高台', position: [35.31395, 139.50770], area: '七里ガ浜' },
    { id: 'sp-shichirigahama-golf', name: '七里ガ浜ゴルフ場', category: '広域避難場所・高台', position: [35.31755, 139.50990], area: '七里ガ浜' },
    { id: 'sp-shichirigahama-high', name: '県立七里ガ浜高等学校', category: '高台', position: [35.30665, 139.51385], area: '七里ガ浜' },
    { id: 'sp-inamuragasaki-park', name: '鎌倉海浜公園 稲村ガ崎地区', category: '高台', position: [35.30385, 139.52255], area: '稲村ガ崎' },
    { id: 'sp-inamuragasaki-es', name: '稲村ケ崎小学校', category: '指定避難所・高台', position: [35.31010, 139.52245], area: '稲村ガ崎' },
    { id: 'sp-genjiyama', name: '源氏山公園', category: '広域避難場所・高台', position: [35.32415, 139.53735], area: '扇ガ谷' },
    { id: 'sp-kuzuharaoka', name: '葛原岡神社', category: '広域避難場所・高台', position: [35.32485, 139.53445], area: '梶原' },
    { id: 'sp-hachimangu', name: '鶴岡八幡宮', category: '広域避難場所', position: [35.32595, 139.55635], area: '雪ノ下' },
    { id: 'sp-yokokoku', name: '横浜国大附属鎌倉小・中学校', category: '広域避難場所', position: [35.32725, 139.55985], area: '雪ノ下' },
    { id: 'sp-kamakura-reien', name: '鎌倉霊園', category: '広域避難場所・高台', position: [35.32785, 139.59210], area: '十二所' },
    { id: 'sp-fueda-park', name: '笛田公園', category: '広域避難場所・高台', position: [35.32485, 139.51585], area: '笛田' },
    { id: 'sp-chuo-park', name: '鎌倉中央公園', category: '広域避難場所・高台', position: [35.33190, 139.52880], area: '山崎' },
    { id: 'sp-fukasawa-jh', name: '深沢中学校', category: '広域避難場所', position: [35.32760, 139.51995], area: '梶原' },
    { id: 'sp-fujizuka-es', name: '富士塚小学校', category: '広域避難場所', position: [35.33675, 139.51925], area: '上町屋' },
    { id: 'sp-ofuna-flower', name: '県立大船フラワーセンター', category: '広域避難場所', position: [35.35270, 139.52235], area: '岡本' },
    { id: 'sp-seisen', name: '清泉女学院', category: '広域避難場所', position: [35.34890, 139.50700], area: '城廻' },
    { id: 'sp-eiko', name: '栄光学園', category: '広域避難場所', position: [35.35715, 139.51435], area: '玉縄' },
    { id: 'sp-country-club', name: '鎌倉カントリークラブ', category: '広域避難場所・高台', position: [35.35460, 139.57320], area: '今泉' },
    { id: 'sp-kamakura-womens', name: '鎌倉女子大学大船キャンパス', category: '広域避難場所', position: [35.35380, 139.53570], area: '大船' }
  ];

  const HAZARD_CONFIG = {
    none: {
      label: { ja: '表示なし', en: 'No hazard overlay', zh: '不显示灾害图层' },
      icon: '地',
      heading: { ja: '現在地と避難先候補を確認してください', en: 'Check your location and evacuation options', zh: '请确认当前位置和避难候选地点' },
      text: { ja: '災害情報を選ぶと、公式ハザードデータを地図に重ねて確認できます。', en: 'Select a hazard to overlay official hazard data on the map.', zh: '选择灾害类型后，可在地图上叠加官方灾害数据。' },
      layers: []
    },
    tsunami: {
      label: { ja: '津波浸水想定', en: 'Tsunami inundation', zh: '海啸浸水预想' },
      icon: '波',
      heading: { ja: '海から離れ、高台へ向かってください', en: 'Move away from the sea and go to higher ground', zh: '请远离海边并前往高地' },
      text: { ja: '揺れがおさまったら、海岸や川沿いから離れ、高台・津波避難ビルなど一時的に安全を確保できる場所へ移動します。', en: 'After the shaking stops, move away from the coast and rivers toward higher ground or a tsunami evacuation building.', zh: '摇晃停止后，请远离海岸和河流，前往高地或海啸避难建筑。' },
      layers: ['https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png']
    },
    flood: {
      label: { ja: '洪水浸水想定', en: 'River flood inundation', zh: '洪水浸水预想' },
      icon: '洪',
      heading: { ja: '河川や低い場所から離れてください', en: 'Move away from rivers and low-lying areas', zh: '请远离河流和低洼地区' },
      text: { ja: '浸水が想定される区域を確認し、河川沿いや地下空間を避けて安全な場所へ移動します。', en: 'Check the expected inundation area and avoid riversides and underground spaces.', zh: '请确认预计浸水区域，避开河边和地下空间。' },
      layers: ['https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png']
    },
    inland: {
      label: { ja: '内水浸水想定', en: 'Pluvial flooding', zh: '内涝浸水预想' },
      icon: '雨',
      heading: { ja: '道路冠水や低地への移動を避けてください', en: 'Avoid flooded roads and low-lying areas', zh: '请避开积水道路和低洼地区' },
      text: { ja: '大雨で排水が追いつかない場所を確認し、冠水しやすい道路や地下空間を避けます。', en: 'Avoid roads and underground spaces where heavy rain may overwhelm drainage.', zh: '请避开因暴雨排水不及而容易积水的道路和地下空间。' },
      layers: ['https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png']
    },
    hightide: {
      label: { ja: '高潮浸水想定', en: 'Storm-surge inundation', zh: '风暴潮浸水预想' },
      icon: '潮',
      heading: { ja: '海岸や河口から離れてください', en: 'Move away from the coast and river mouths', zh: '请远离海岸和河口' },
      text: { ja: '台風などで海面が上昇する可能性があるため、海岸部を避けて内陸や高い場所へ移動します。', en: 'Move inland or to higher ground because storm surge can raise sea levels during typhoons.', zh: '台风等可能导致海面上升，请远离海岸并前往内陆或高地。' },
      layers: ['https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png']
    },
    landslide: {
      label: { ja: '土砂災害警戒区域', en: 'Landslide warning zones', zh: '地质灾害警戒区域' },
      icon: '崖',
      heading: { ja: '崖や急傾斜地から離れてください', en: 'Move away from cliffs and steep slopes', zh: '请远离悬崖和陡坡' },
      text: { ja: '土石流、急傾斜地の崩壊、地すべりの警戒区域を確認し、崖沿いや谷筋を避けます。', en: 'Avoid cliffs and valleys shown as debris-flow, steep-slope or landslide warning zones.', zh: '请避开被标示为泥石流、陡坡崩塌或滑坡警戒区域的悬崖和山谷。' },
      layers: [
        'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
        'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
        'https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png'
      ]
    }
  };



  const SAFE_ROUTE_WAYPOINTS = {
    ofuna: { lat: 35.35390, lng: 139.53110, label: '大船方面' },
    kitaKamakura: { lat: 35.33770, lng: 139.54510, label: '北鎌倉方面' },
    hachimanguNorth: { lat: 35.32720, lng: 139.55640, label: '八幡宮北側' },
    fujisawaNorth: { lat: 35.35420, lng: 139.48980, label: '藤沢北側' },
    fuedaNorth: { lat: 35.32560, lng: 139.51750, label: '笛田方面' }
  };

  const RIVER_AVOID_SEGMENTS = [
    { name: '柏尾川', start: { lat: 35.3525, lng: 139.5325 }, end: { lat: 35.3240, lng: 139.5458 }, weight: 9 },
    { name: '滑川', start: { lat: 35.3278, lng: 139.5581 }, end: { lat: 35.3090, lng: 139.5560 }, weight: 10 },
    { name: '神戸川', start: { lat: 35.3175, lng: 139.5388 }, end: { lat: 35.3060, lng: 139.5322 }, weight: 8 },
    { name: '砂押川', start: { lat: 35.3480, lng: 139.5508 }, end: { lat: 35.3355, lng: 139.5490 }, weight: 7 },
    { name: '二階堂川', start: { lat: 35.3305, lng: 139.5680 }, end: { lat: 35.3202, lng: 139.5574 }, weight: 7 },
    { name: '小袋谷川', start: { lat: 35.3453, lng: 139.5446 }, end: { lat: 35.3336, lng: 139.5442 }, weight: 6 }
  ];

  const ROUTE_RISK_ZONES = [
    { name: '鎌倉海岸低地', hazards: ['tsunami', 'hightide', 'flood', 'inland'], weight: 1600, bounds: [[35.2940, 139.5140], [35.3195, 139.5755]] },
    { name: '腰越・七里ヶ浜沿岸', hazards: ['tsunami', 'hightide', 'flood', 'inland'], weight: 1500, bounds: [[35.2950, 139.4800], [35.3145, 139.5200]] },
    { name: '金沢八景沿岸', hazards: ['tsunami', 'hightide'], weight: 900, bounds: [[35.3200, 139.6000], [35.3900, 139.6750]] },
    { name: '横浜湾岸部', hazards: ['tsunami', 'hightide'], weight: 850, bounds: [[35.3900, 139.6250], [35.5000, 139.7650]] },
    { name: '低地河川沿い', hazards: ['flood', 'inland'], weight: 700, bounds: [[35.3150, 139.5350], [35.3320, 139.5650]] },
    { name: '山際・急傾斜地周辺', hazards: ['landslide'], weight: 650, bounds: [[35.3030, 139.5000], [35.3375, 139.5430]] }
  ];

  const CONGESTION_ZONES = [
    { id: 'kamakura-station', name: '鎌倉駅東口周辺', center: [35.3193, 139.5504], radius: 340, level: 3 },
    { id: 'komachi', name: '小町通り周辺', center: [35.3222, 139.5521], radius: 240, level: 2 },
    { id: 'yuigahama', name: '由比ヶ浜通り周辺', center: [35.3142, 139.5482], radius: 220, level: 2 }
  ];

  const TRANSPORT_SERVICES = [
    {
      id: 'jr-yokosuka',
      name: { ja: 'JR横須賀線', en: 'JR Yokosuka Line', zh: 'JR横须贺线' },
      normal: { ja: '平常運転', en: 'Normal service', zh: '正常运行' },
      disaster: { ja: '遅延・入場規制（デモ）', en: 'Delay / entry control (demo)', zh: '延误・进站限制（演示）' }
    },
    {
      id: 'enoden',
      name: { ja: '江ノ島電鉄', en: 'Enoden', zh: '江之岛电铁' },
      normal: { ja: '平常運転', en: 'Normal service', zh: '正常运行' },
      disaster: { ja: '運転見合わせ（デモ）', en: 'Service suspended (demo)', zh: '暂停运行（演示）' }
    },
    {
      id: 'bus',
      name: { ja: '路線バス', en: 'Local buses', zh: '公交线路' },
      normal: { ja: '通常運行', en: 'Normal service', zh: '正常运行' },
      disaster: { ja: '道路混雑による遅延（デモ）', en: 'Traffic delays (demo)', zh: '道路拥堵延误（演示）' }
    }
  ];


  const I18N = {
    ja: {
      brandKicker: '観光客向け防災情報', siteTitle: '鎌倉市 災害避難支援ポータル', menuTitle: 'メニュー', backTop: 'トップへ', navEmergency: '緊急情報', navMap: '現在地・避難経路', navCandidate: '避難先候補', navScenario: '災害別案内', navOffline: 'オフライン利用', navFuture: '発展機能', forceGps: 'GPSを再取得',
      demoLabel: '授業発表用デモ', demoTitle: '実際の災害情報ではありません', demoText: '実際の災害時は、鎌倉市・気象庁・警察・消防などの最新情報に従ってください。',
      locateNow: '現在地から避難先を確認', locationStatusLabel: '現在地', selectedDisasterLabel: '表示中のハザード', routeStatusLabel: '徒歩経路',
      mapTitle: '現在地と災害リスクを確認', mapLead: '災害情報を選択し、現在地から避難先候補までの歩行者向け最短経路を地図上に表示します。', officialMap: '公式ハザードマップを開く',
      hazardLayer: '重ねる災害情報', clearHazards: 'すべて解除', getLocation: 'GPSで現在地を取得', startTracking: '現在地の追跡を開始', stopTracking: '現在地の追跡を停止', resetMap: '鎌倉市全体を表示', prepareOffline: '現在の表示をオフライン保存',
      demoLocationTitle: 'デモ位置を使う', useStationDemo: '鎌倉駅を現在地にする', useCoastDemo: '由比ヶ浜付近を現在地にする',
      mapNote: 'オンライン中に表示した地図・ハザードと計算済みルートは、オフラインでも再表示できます。新しい地域や新しい経路の取得には通信が必要です。', candidateEyebrow: 'EVACUATION DESTINATIONS', candidateTitle: '避難先候補',
      candidateDisclaimer: '候補地は鎌倉市の公開情報をもとにした授業用デモです。実際の避難では自治体の指示と現地状況を優先してください。', guidanceTitle: '災害発生時の初期行動', offlineTitle: 'オフライン利用', offlineWorksTitle: '通信なしでも使えるもの', offlineWorksText: '保存済みの現在地、オンライン中に表示した地図・ハザード、計算済みの徒歩ルート、初期行動案内を再表示できます。', offlineNeedsTitle: '通信が必要なもの', offlineNeedsText: '未表示地域の地図、新しいハザードタイル、新しい現在地からの経路計算、最新の災害情報の取得には通信が必要です。',
      navTransport: '交通情報', navReport: '通行不可報告', navNotifications: '通知', navAdmin: '管理者デモ', navSystem: 'システム構成', startScenario: '由比ヶ浜 津波デモ開始', transportTitle: '交通機関の運行情報', transportLead: 'JR・江ノ電などの運行状況を表示し、運休時には駅への集中を避ける判断材料にします。', demoData: 'デモデータ', prototypeLabel: '試作機能', toggleTransportDemo: '運休デモを切替', backMap: '地図へ戻る', reportTitle: '通れない道などの報告', reportLead: '現在地または地図上で地点を指定し、通行不可・倒木・浸水などを報告します。報告地点はルート評価に反映します。', reportTypeLabel: '種類', reportNoteLabel: '補足', useCurrentReport: '現在地を使う', pickReportMap: '地図で地点指定', submitReport: '報告を登録', notificationTitle: '通知・警告', offlineLabTitle: 'オフライン動作', offlineShellText: 'HTML・CSS・JavaScriptなどのアプリ本体をキャッシュします。', offlineDataText: '避難先状態・報告情報・計算済みルートなどを端末側へ保持します。', offlineFutureText: '端末内の新規経路計算は設計・技術検証対象です。現行デモでは保存済みルートを利用します。', adminTitle: '総合防災課 管理者デモ', adminLead: '避難所の管理は開設ON/OFFに絞り、道路混雑や利用者報告と組み合わせて避難先候補へ反映する試作です。', toggleCongestionDemo: '道路混雑デモを切替', resetDemo: 'デモ状態を初期化', systemTitle: 'システム構成',      focus: '地図で確認', route: '徒歩ルートを表示', notSet: '未取得', notSelected: '未選択'
    },
    en: {
      brandKicker: 'Disaster information for visitors', siteTitle: 'Kamakura Evacuation Support Portal', menuTitle: 'Menu', backTop: 'Top', navEmergency: 'Emergency', navMap: 'Location & route', navCandidate: 'Evacuation options', navScenario: 'Guidance', navOffline: 'Offline use', navFuture: 'Future functions', forceGps: 'Refresh GPS',
      demoLabel: 'CLASS PROJECT DEMO', demoTitle: 'This is not live emergency information', demoText: 'In a real emergency, follow the latest instructions from Kamakura City and emergency authorities.',
      locateNow: 'Check evacuation options from my location', locationStatusLabel: 'Current location', selectedDisasterLabel: 'Hazard overlay', routeStatusLabel: 'Walking route',
      mapTitle: 'Check your location and disaster risks', mapLead: 'Select a hazard and display a shortest pedestrian route from your location to an evacuation option.', officialMap: 'Open official hazard map',
      hazardLayer: 'Hazard overlay', clearHazards: 'Clear all', getLocation: 'Get GPS location', startTracking: 'Start location tracking', stopTracking: 'Stop location tracking', resetMap: 'Show all of Kamakura', prepareOffline: 'Save current view offline',
      demoLocationTitle: 'Use demo location', useStationDemo: 'Use Kamakura Station', useCoastDemo: 'Use Yuigahama coast',
      mapNote: 'Map and hazard tiles viewed online and calculated routes can be reopened offline. New map areas and new route calculations require a connection.', candidateEyebrow: 'EVACUATION DESTINATIONS', candidateTitle: 'Evacuation options',
      candidateDisclaimer: 'Destinations are based on Kamakura City public information for a classroom demo. Follow official instructions in a real emergency.', guidanceTitle: 'First action during a disaster', offlineTitle: 'Offline use', offlineWorksTitle: 'Available without a connection', offlineWorksText: 'You can reopen your saved location, map and hazard tiles viewed online, calculated walking routes and first-action guidance.', offlineNeedsTitle: 'Requires a connection', offlineNeedsText: 'New map areas, new hazard tiles, new route calculations and current emergency information require a connection.',
      navTransport: 'Transport', navReport: 'Road report', navNotifications: 'Notifications', navAdmin: 'Admin demo', navSystem: 'System', startScenario: 'Start Yuigahama tsunami demo', transportTitle: 'Public transport status', transportLead: 'Displays railway and bus status and helps avoid unnecessary concentration around stations.', demoData: 'Demo data', prototypeLabel: 'Prototype', toggleTransportDemo: 'Toggle disruption demo', backMap: 'Back to map', reportTitle: 'Report an impassable road', reportLead: 'Choose your current location or a point on the map and report a blocked road, flooding, debris or severe congestion.', reportTypeLabel: 'Type', reportNoteLabel: 'Note', useCurrentReport: 'Use current location', pickReportMap: 'Pick on map', submitReport: 'Submit report', notificationTitle: 'Notifications and warnings', offlineLabTitle: 'Offline operation', offlineShellText: 'Caches the application shell such as HTML, CSS and JavaScript.', offlineDataText: 'Keeps shelter states, reports and calculated routes on the device.', offlineFutureText: 'New route calculation on the device is a design and verification target. The current demo uses saved routes.', adminTitle: 'Disaster management admin demo', adminLead: 'Shelter management is reduced to open/closed status and is combined with road congestion and user reports.', toggleCongestionDemo: 'Toggle congestion demo', resetDemo: 'Reset demo', systemTitle: 'System architecture',      focus: 'View on map', route: 'Show walking route', notSet: 'Not acquired', notSelected: 'Not selected'
    },
    zh: {
      brandKicker: '面向游客的防灾信息', siteTitle: '镰仓市灾害避难支援门户', menuTitle: '菜单', backTop: '返回顶部', navEmergency: '紧急信息', navMap: '当前位置与路线', navCandidate: '避难候选地点', navScenario: '灾害指南', navOffline: '离线使用', navFuture: '扩展功能', forceGps: '重新获取GPS',
      demoLabel: '课堂演示', demoTitle: '这不是真实的灾害信息', demoText: '实际发生灾害时，请遵循镰仓市及消防、警察等机构的最新信息。',
      locateNow: '从当前位置确认避难地点', locationStatusLabel: '当前位置', selectedDisasterLabel: '灾害图层', routeStatusLabel: '步行路线',
      mapTitle: '确认当前位置和灾害风险', mapLead: '选择灾害图层，并显示从当前位置到避难候选地点的步行最短路线。', officialMap: '打开官方灾害地图',
      hazardLayer: '叠加灾害信息', clearHazards: '全部清除', getLocation: '通过GPS获取位置', startTracking: '开始追踪位置', stopTracking: '停止追踪位置', resetMap: '显示整个镰仓市', prepareOffline: '保存当前离线显示',
      demoLocationTitle: '使用演示位置', useStationDemo: '使用镰仓站位置', useCoastDemo: '使用由比滨海岸位置',
      mapNote: '在线浏览过的地图和灾害图层及已计算路线可在离线时重新显示。新的区域和新的路线计算需要网络。', candidateEyebrow: 'EVACUATION DESTINATIONS', candidateTitle: '避难候选地点',
      candidateDisclaimer: '候选地点基于镰仓市公开信息，仅用于课堂演示。实际灾害时请遵循官方指示。', guidanceTitle: '灾害发生时的初步行动', offlineTitle: '离线使用', offlineWorksTitle: '无网络也可使用', offlineWorksText: '可重新显示保存的位置、在线浏览过的地图和灾害图层、已计算的步行路线及初步行动指南。', offlineNeedsTitle: '需要网络', offlineNeedsText: '新的地图区域、灾害图层、路线计算和最新灾害信息需要网络连接。',
      navTransport: '交通信息', navReport: '道路报告', navNotifications: '通知', navAdmin: '管理演示', navSystem: '系统构成', startScenario: '启动由比滨海啸演示', transportTitle: '交通运行信息', transportLead: '显示铁路和公交运行状态，并在停运时帮助避免人员集中到车站。', demoData: '演示数据', prototypeLabel: '试作功能', toggleTransportDemo: '切换停运演示', backMap: '返回地图', reportTitle: '道路无法通行报告', reportLead: '使用当前位置或地图选点，报告道路封闭、积水、障碍物或严重拥堵。', reportTypeLabel: '类型', reportNoteLabel: '补充', useCurrentReport: '使用当前位置', pickReportMap: '在地图上选点', submitReport: '提交报告', notificationTitle: '通知与警告', offlineLabTitle: '离线运行', offlineShellText: '缓存HTML、CSS、JavaScript等应用主体。', offlineDataText: '在设备上保存避难点状态、报告信息和已计算路线。', offlineFutureText: '设备内的新路线计算仍是设计和技术验证目标，目前演示使用已保存路线。', adminTitle: '综合防灾部门管理演示', adminLead: '避难所管理简化为开放/关闭，并结合道路拥堵和用户报告影响候选地点。', toggleCongestionDemo: '切换道路拥堵演示', resetDemo: '重置演示状态', systemTitle: '系统构成',      focus: '在地图上查看', route: '显示步行路线', notSet: '未获取', notSelected: '未选择'
    }
  };


  function loadSavedPosition() {
    try {
      const data = JSON.parse(localStorage.getItem(LAST_POSITION_KEY) || 'null');
      if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function savePosition(position) {
    try {
      localStorage.setItem(LAST_POSITION_KEY, JSON.stringify({
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy || 0,
        label: position.label || 'GPS現在地',
        savedAt: Date.now()
      }));
    } catch (_) {}
  }

  function loadRouteCache() {
    const map = new Map();
    try {
      const items = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '[]');
      if (Array.isArray(items)) {
        items.forEach(([key, value]) => {
          if (key && value && Array.isArray(value.coordinates)) map.set(key, value);
        });
      }
    } catch (_) {}
    return map;
  }

  function persistRouteCache() {
    try {
      const entries = Array.from(state.routeCache.entries())
        .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
        .slice(0, 16);
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(entries));
    } catch (_) {}
  }

  function loadHazardSelection() {
    try {
      const value = JSON.parse(localStorage.getItem(HAZARD_SELECTION_KEY) || 'null');
      return Array.isArray(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function persistHazardSelection() {
    try {
      localStorage.setItem(HAZARD_SELECTION_KEY, JSON.stringify(selectedHazards()));
    } catch (_) {}
  }


  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function openPrototypeDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('shelters')) db.createObjectStore('shelters', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function mirrorReportsToIndexedDb() {
    try {
      const db = await openPrototypeDb();
      if (!db) return;
      const tx = db.transaction('reports', 'readwrite');
      const store = tx.objectStore('reports');
      store.clear();
      state.reports.forEach((report) => store.put(report));
    } catch (_) {}
  }

  async function mirrorSheltersToIndexedDb() {
    try {
      const db = await openPrototypeDb();
      if (!db) return;
      const tx = db.transaction('shelters', 'readwrite');
      const store = tx.objectStore('shelters');
      store.clear();
      Object.entries(state.shelterStatus).forEach(([id, open]) => store.put({ id, open }));
    } catch (_) {}
  }
  // ==============================
  // Firebase / Firestore
  // ==============================
  const firebaseConfig = {
    apiKey: "AIzaSyCOMU57c8NGJUrYKdqJa-rDyU7SKNCDFnM",
    authDomain: "kamakura-disaster-app-5096b.firebaseapp.com",
    projectId: "kamakura-disaster-app-5096b",
    storageBucket: "kamakura-disaster-app-5096b.firebasestorage.app",
    messagingSenderId: "318017049331",
    appId: "1:318017049331:web:81b67e9e0d93b17c3edd86"
  };

  let firestoreDb = null;

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    firestoreDb = firebase.firestore();
    console.log('Firestoreを初期化しました。');
  }

  const state = {
    lang: 'ja', map: null, userPosition: null, userMarker: null, accuracyCircle: null,
    candidateMarkers: [], safePointMarkers: [], routeLine: null, hazardLayers: [], selectedCandidateId: null,
    watchId: null, routeCache: loadRouteCache(), routeLoading: false, activeHazard: 'tsunami', safePointLayerVisible: true,
    locationRequestInProgress: false, permissionState: 'unknown',
    reports: loadJson(REPORTS_KEY, []),
    shelterStatus: loadJson(SHELTER_STATUS_KEY, {}),
    congestionDemo: Boolean(loadJson(CONGESTION_KEY, false)),
    transportDisruption: Boolean(loadJson(TRANSPORT_KEY, false)),
    reportMarkers: [],
    congestionLayers: [],
    reportPickMode: false,
    reportTrack: [],
    reportTrackActive: false,
    reportTrackLine: null,
    reportTrackRangeLine: null
  };

  const el = (id) => document.getElementById(id);

  function initMap() {
    if (typeof L === 'undefined') {
      el('map').innerHTML = '<div class="map-load-error">地図ライブラリを読み込めませんでした。インターネット接続を確認してください。</div>';
      return;
    }

    state.map = L.map('map', { zoomControl: true, preferCanvas: true, closePopupOnClick: true });
    state.map.on('zoomend', renderReportTrackLayers);
    restoreReportTrack();
    renderReportTrackLayers();
    state.map.zoomControl.setPosition('bottomleft');
    state.map.createPane('hazardPane');
    state.map.getPane('hazardPane').style.zIndex = '250';
    state.map.getPane('hazardPane').style.pointerEvents = 'none';

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    resetMap();
    renderHazardLayer();
    updateGuidance();
    updateNetworkState();
    state.map.on('click', (event) => {
      if (!state.reportPickMode) return;
      state.reportPickMode = false;
      if (el('reportLat')) el('reportLat').value = event.latlng.lat.toFixed(6);
      if (el('reportLng')) el('reportLng').value = event.latlng.lng.toFixed(6);
      showScreen('report');
      showToast('報告地点を地図から指定しました。');
    });
    renderOperationalLayers();
    setTimeout(() => { resetMap(); state.map.invalidateSize(); }, 150);
  }

  function createHazardTile(url, opacity = 0.72) {
    return L.tileLayer(url, {
      pane: 'hazardPane', opacity, maxZoom: 17, maxNativeZoom: 17,
      attribution: '災害リスク情報：<a href="https://disaportal.gsi.go.jp/" target="_blank" rel="noopener">ハザードマップポータルサイト</a>'
    });
  }

  function selectedHazards() {
    return Array.from(document.querySelectorAll('input[name="hazardLayer"]:checked')).map((input) => input.value);
  }

  function primaryHazard() {
    const selected = selectedHazards();
    if (selected.includes(state.activeHazard)) return state.activeHazard;
    return selected[0] || 'none';
  }

  function renderHazardLayer() {
    if (!state.map) return;
    state.hazardLayers.forEach((layer) => state.map.removeLayer(layer));
    state.hazardLayers = [];

    const selected = selectedHazards();
    selected.forEach((type) => {
      const config = HAZARD_CONFIG[type];
      config.layers.forEach((url) => {
        const layer = createHazardTile(url, type === 'landslide' ? 0.58 : 0.46);
        layer.addTo(state.map);
        state.hazardLayers.push(layer);
      });
    });

    const labels = selected.map((type) => HAZARD_CONFIG[type].label[state.lang]);
    const summary = labels.length ? labels.join('・') : HAZARD_CONFIG.none.label[state.lang];
    el('hazardLayerName').textContent = summary;
    el('disasterSummary').textContent = summary;
  }

  function markerIcon(number, type) {
    const variant = type === 'high-ground' ? 'green' : 'blue';
    return L.divIcon({
      className: 'candidate-pin-shell',
      html: `<span class="candidate-pin ${variant}">${number}</span>`,
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18]
    });
  }

  function userIcon() {
    return L.divIcon({ className: 'user-pin-shell', html: '<span class="user-pin"><span></span></span>', iconSize: [32, 32], iconAnchor: [16, 16] });
  }

  function setUserPosition(lat, lng, accuracy, label, persist = true) {
    state.userPosition = { lat, lng, accuracy: accuracy || 0, label: label || 'GPS現在地' };
    if (persist) savePosition(state.userPosition);
    if (!state.map) return;

    const latlng = [lat, lng];
    if (!state.userMarker) state.userMarker = L.marker(latlng, { icon: userIcon(), zIndexOffset: 1000 }).addTo(state.map).bindPopup('現在地');
    else state.userMarker.setLatLng(latlng);

    // Hide variable GPS uncertainty while showing the fixed reportable buffer.
    if (state.reportTrack.length) {
      if (state.accuracyCircle) {
        if (state.map.hasLayer(state.accuracyCircle)) state.map.removeLayer(state.accuracyCircle);
        state.accuracyCircle = null;
      }
    } else if (!state.accuracyCircle) {
      state.accuracyCircle = L.circle(latlng, { radius: Math.max(accuracy || 10, 10), color: '#075b96', weight: 1, fillColor: '#1685bd', fillOpacity: 0.12 }).addTo(state.map);
    } else {
      state.accuracyCircle.setLatLng(latlng).setRadius(Math.max(accuracy || 10, 10));
    }

    state.map.setView(latlng, 14);
    el('latitudeValue').textContent = lat.toFixed(6);
    el('longitudeValue').textContent = lng.toFixed(6);
    el('accuracyValue').textContent = accuracy ? `約${Math.round(accuracy)} m` : 'デモ位置';
    el('locationSummary').textContent = label || '現在地取得済み';
    el('gpsState').textContent = accuracy ? 'GPS取得済み' : 'デモ位置';
    el('gpsState').className = 'state-chip';
    el('locationMessage').textContent = accuracy ? `現在地を取得しました（精度 約${Math.round(accuracy)}m）。` : `${label}を現在地として設定しました。`;

    clearRoute();
    renderCandidates();
    refreshSafePoints();
  }

  function setLocationButtonsBusy(isBusy) {
    state.locationRequestInProgress = isBusy;
    ['locateButton', 'heroLocateButton', 'headerGpsButton'].forEach((id) => {
      const button = el(id);
      if (!button) return;
      button.disabled = isBusy;
      button.classList.toggle('is-busy', isBusy);
    });
  }

  async function getPermissionState() {
    if (!navigator.permissions?.query) return 'unknown';
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      state.permissionState = status.state;
      status.onchange = () => { state.permissionState = status.state; };
      return status.state;
    } catch (_) {
      return 'unknown';
    }
  }

  function requestBrowserPosition(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  const REPORT_TRACK_SESSION_KEY = 'kamakura-report-gps-track-v1';
  const REPORT_TRACK_MAX_POINTS = 3000;
  const REPORT_TRACK_MAX_ACCURACY = 50;
  const REPORT_TRACK_BUFFER_METERS = 50;
  const REPORT_TRACK_MIN_POINTS = 3;
  const REPORT_TRACK_MIN_DISTANCE_METERS = 25;

  function distanceFromPinToGpsSegmentMeters(point, start, end) {
    const metersPerDegree = 111320;
    const longitudeScale = metersPerDegree * Math.cos(point.lat * Math.PI / 180);
    const xy = (value) => ({
      x: (value.lng - point.lng) * longitudeScale,
      y: (value.lat - point.lat) * metersPerDegree
    });
    const a = xy(start);
    const b = xy(end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    return Math.hypot(a.x + t * dx, a.y + t * dy);
  }
  function saveReportTrack() {
    try { sessionStorage.setItem(REPORT_TRACK_SESSION_KEY, JSON.stringify(state.reportTrack)); } catch (_) {}
  }

  function restoreReportTrack() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(REPORT_TRACK_SESSION_KEY) || '[]');
      if (Array.isArray(saved)) {
        state.reportTrack = saved.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng) && Number.isFinite(point?.time));
      }
    } catch (_) {
      state.reportTrack = [];
    }
    if (state.reportTrack.length) {
      updateReportTrackStatus('保存されたGPS軌跡を表示中です。青線が移動軌跡、薄青の帯がその左右50mの投稿可能範囲です。');
    }
  }

  function reportTrackRangeWeight() {
    const centerLatitude = state.reportTrack.reduce((sum, point) => sum + point.lat, 0) / state.reportTrack.length;
    const metersPerPixel = 156543.03392 * Math.cos(centerLatitude * Math.PI / 180) / (2 ** state.map.getZoom());
    return Math.max(2, (REPORT_TRACK_BUFFER_METERS * 2) / metersPerPixel);
  }
  function renderReportTrackLayers() {
    if (!state.map) return;
    [state.reportTrackLine, state.reportTrackRangeLine].forEach((layer) => {
      if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    state.reportTrackLine = null;
    state.reportTrackRangeLine = null;
    if (!state.reportTrack.length) return;

    const points = state.reportTrack.map((point) => [point.lat, point.lng]);
    if (points.length === 1) {
      state.reportTrackRangeLine = L.circle(points[0], {
        radius: REPORT_TRACK_BUFFER_METERS,
        color: '#0878b5', weight: 1, opacity: 0.55,
        fillColor: '#1685bd', fillOpacity: 0.14, interactive: false
      }).addTo(state.map);
      return;
    }

    state.reportTrackRangeLine = L.polyline(points, {
      color: '#1685bd',
      weight: reportTrackRangeWeight(),
      opacity: 0.2,
      lineCap: 'round', lineJoin: 'round', interactive: false
    }).addTo(state.map);
    state.reportTrackLine = L.polyline(points, {
      color: '#075b96', weight: 4, opacity: 0.95,
      lineCap: 'round', lineJoin: 'round', interactive: false
    }).addTo(state.map);
    state.reportTrackLine.bringToFront();
  }
  function appendReportTrackPointToLayers(point) {
    if (!state.map) return;
    const latlng = [point.lat, point.lng];
    if (state.reportTrack.length === 1) {
      state.reportTrackRangeLine = L.circle(latlng, {
        radius: REPORT_TRACK_BUFFER_METERS,
        color: '#0878b5', weight: 1, opacity: 0.55,
        fillColor: '#1685bd', fillOpacity: 0.14, interactive: false
      }).addTo(state.map);
      return;
    }
    if (!state.reportTrackLine) {
      if (state.reportTrackRangeLine && state.map.hasLayer(state.reportTrackRangeLine)) state.map.removeLayer(state.reportTrackRangeLine);
      const initialPoints = state.reportTrack.slice(-2).map((item) => [item.lat, item.lng]);
      state.reportTrackRangeLine = L.polyline(initialPoints, {
        color: '#1685bd', weight: reportTrackRangeWeight(), opacity: 0.2,
        lineCap: 'round', lineJoin: 'round', interactive: false
      }).addTo(state.map);
      state.reportTrackLine = L.polyline(initialPoints, {
        color: '#075b96', weight: 4, opacity: 0.95,
        lineCap: 'round', lineJoin: 'round', interactive: false
      }).addTo(state.map);
      state.reportTrackLine.bringToFront();
      return;
    }
    state.reportTrackRangeLine.addLatLng(latlng);
    state.reportTrackLine.addLatLng(latlng);
  }
  function updateReportTrackStatus(message) {
    const status = el('reportTrackStatus');
    if (status) status.textContent = message;
  }
  function recordReportTrackPosition(position) {
    const { latitude: lat, longitude: lng, accuracy } = position.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy) || accuracy > REPORT_TRACK_MAX_ACCURACY) return false;
    const point = { lat, lng, accuracy, time: position.timestamp || Date.now() };
    const previous = state.reportTrack[state.reportTrack.length - 1];
    if (previous) {
      const distance = haversine(previous, point);
      const elapsedSeconds = Math.max(0.1, (point.time - previous.time) / 1000);
      if (distance < 5 || distance / elapsedSeconds > 12) return false;
    }
    state.reportTrack.push(point);
    if (state.reportTrack.length > REPORT_TRACK_MAX_POINTS) {
      state.reportTrack.shift();
      renderReportTrackLayers();
    } else {
      appendReportTrackPointToLayers(point);
    }
    saveReportTrack();
    return true;
  }

  function startReportTrack(initialPosition) {
    if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
    state.reportTrack = [];
    try { sessionStorage.removeItem(REPORT_TRACK_SESSION_KEY); } catch (_) {}
    renderReportTrackLayers();
    state.reportTrackActive = true;
    recordReportTrackPosition(initialPosition);
    state.watchId = navigator.geolocation.watchPosition((position) => {
      const accepted = recordReportTrackPosition(position);
      if (!accepted || position.coords.accuracy > 100) return;
      setUserPosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy, 'GPS追跡中', true);
    }, (error) => {
      state.reportTrackActive = false;
      if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
      el('trackButton').textContent = I18N[state.lang].startTracking;
      updateReportTrackStatus('GPS軌跡の記録は停止しました。記録済みの軌跡はこのページを閉じるまで投稿判定に使えます。');
      if (error.code === 1) showToast('位置情報の利用が拒否され、軌跡の記録を停止しました。');
      else showToast('GPS軌跡の記録が停止しました。記録済みの軌跡は投稿判定に使えます。');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
    el('trackButton').textContent = I18N[state.lang].stopTracking;
    updateReportTrackStatus('GPS軌跡を記録中です。少し移動してから、記録した道の50m以内を指定してください。');
    showToast('GPS軌跡の記録を開始しました。移動後、記録した道の近くから投稿できます。');
  }
  async function getCurrentPosition({ force = false, recordTrack = false } = {}) {
    if (!navigator.geolocation) {
      showToast('このブラウザは位置情報取得に対応していません。');
      return;
    }
    if (state.locationRequestInProgress) {
      showToast('現在地を取得中です。少しお待ちください。');
      return;
    }

    const saved = loadSavedPosition();
    const savedIsFresh = saved && (Date.now() - (saved.savedAt || 0) < MAX_SAVED_POSITION_AGE);

    if (!force && state.userPosition && !String(state.userPosition.label).includes('デモ')) {
      state.map?.setView([state.userPosition.lat, state.userPosition.lng], 15);
      showToast('取得済みの現在地を表示しました。更新は上部メニューの「GPSを再取得」から行えます。');
      return;
    }

    if (!force && savedIsFresh) {
      setUserPosition(saved.lat, saved.lng, saved.accuracy || 0, '保存済み現在地', false);
      showToast('保存済みの現在地を使用しました。GPSの許可画面は表示しません。');
      return;
    }

    const permission = await getPermissionState();
    if (permission === 'denied') {
      el('locationMessage').textContent = 'ブラウザ設定で位置情報が拒否されています。アドレスバー左側の設定から許可してください。';
      el('gpsState').textContent = 'GPS拒否';
      el('gpsState').className = 'state-chip muted';
      showToast('位置情報が拒否されています。ブラウザのサイト設定を確認してください。');
      return;
    }

    setLocationButtonsBusy(true);
    el('locationMessage').textContent = '現在地を取得しています…';
    el('gpsState').textContent = 'GPS取得中';

    try {
      let pos;
      try {
        pos = await requestBrowserPosition({ enableHighAccuracy: true, timeout: 18000, maximumAge: force ? 0 : 300000 });
      } catch (firstError) {
        if (firstError.code === 1) throw firstError;
        pos = await requestBrowserPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
      }
      setUserPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'GPS現在地', true);
      if (recordTrack) startReportTrack(pos);
      else showToast(force ? 'GPSの現在地を更新しました。' : '現在地を取得しました。次回は保存済み位置を利用します。');
    } catch (error) {
      const messages = {
        1: '位置情報の利用が許可されていません。',
        2: '現在地を取得できませんでした。',
        3: '位置情報の取得がタイムアウトしました。'
      };
      if (saved) {
        setUserPosition(saved.lat, saved.lng, saved.accuracy || 0, '保存済み現在地', false);
        el('locationMessage').textContent = `${messages[error.code] || '現在地を取得できませんでした。'} 保存済み位置を表示しています。`;
        showToast('GPSの再取得に失敗したため、保存済み位置を表示しました。');
      } else {
        useOfflineSavedPosition('保存済み現在地');
        el('gpsState').textContent = 'GPS未取得';
        el('gpsState').className = 'state-chip muted';
        showToast('GPSを取得できませんでした。保存済み位置がある場合のみ案内します。');
      }
    } finally {
      setLocationButtonsBusy(false);
    }
  }

  function useOfflineSavedPosition(reason = '保存済み現在地') {
    const saved = loadSavedPosition();
    if (saved && isInsideBounds({ lat: saved.lat, lng: saved.lng }, KAMAKURA_BOUNDS_COORDS)) {
      setUserPosition(saved.lat, saved.lng, saved.accuracy || 0, reason, false);
      el('locationMessage').textContent = '保存済み現在地を使用して避難先案内を表示しています。';
      return true;
    }
    state.userPosition = null;
    if (state.userMarker && state.map) {
      state.map.removeLayer(state.userMarker);
      state.userMarker = null;
    }
    el('locationSummary').textContent = '未取得';
    el('routeSummary').textContent = '未選択';
    el('locationMessage').textContent = 'オフラインでは新しい現在地を取得できない場合があります。オンライン中にGPSを取得して保存してください。';
    el('gpsState').textContent = navigator.onLine ? 'GPS未取得' : 'オフライン・GPS未取得';
    renderCandidates();
    return false;
  }

  async function toggleTracking() {
    if (!navigator.geolocation) return;
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
      state.reportTrackActive = false;
      el('trackButton').textContent = I18N[state.lang].startTracking;
      if (state.reportTrack.length) updateReportTrackStatus('GPS軌跡の記録を停止しました。記録済みの軌跡は投稿判定に使えます。');
      showToast(state.reportTrack.length ? 'GPS軌跡の記録を停止しました。記録済みの軌跡は投稿判定に使えます。' : '現在地の追跡を停止しました。');
      return;
    }

    const permission = await getPermissionState();
    if (permission === 'denied') {
      useOfflineSavedPosition('保存済み現在地');
      showToast('位置情報が拒否されています。保存済み位置がある場合のみ案内します。');
      return;
    }

    state.reportTrackActive = state.reportTrack.length > 0;
    state.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (state.reportTrackActive) recordReportTrackPosition(pos);
        setUserPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'GPS追跡中', true);
      },
      (error) => {
        if (error.code === 1) showToast('位置情報の利用が拒否されました。');
        else showToast('現在地の追跡に失敗しました。保存済み位置は引き続き利用できます。');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    el('trackButton').textContent = I18N[state.lang].stopTracking;
    showToast(state.reportTrackActive ? '現在地とGPS軌跡の記録を再開しました。' : '現在地の追跡を開始しました。');
  }

  function isTsunamiPriorityMode() {
    const selected = selectedHazards();
    return selected.includes('tsunami') || selected.includes('hightide');
  }

  function isHeadingTowardSea(candidate) {
    if (!state.userPosition) return false;
    const bearing = bearingBetween(state.userPosition, { lat: candidate.position[0], lng: candidate.position[1] });
    const isSouthward = bearing >= 115 && bearing <= 245;
    const isLowerLatitude = candidate.position[0] < state.userPosition.lat - 0.001;
    return isSouthward && isLowerLatitude;
  }

  function candidateRank(candidate) {
    let score = isTsunamiPriorityMode() ? (candidate.tsunamiPriority || 0) : 100 - (candidate.priority || 50);
    if (state.congestionDemo) {
      const point = { lat: candidate.position[0], lng: candidate.position[1] };
      CONGESTION_ZONES.forEach((zone) => {
        if (haversine(point, { lat: zone.center[0], lng: zone.center[1] }) < zone.radius + 220) score -= zone.level * 8;
      });
    }
    return score;
  }

  function isShelterOpen(id) {
    return state.shelterStatus[id] !== false;
  }

  function getFilteredCandidates() {
    const hazard = primaryHazard();
    const tsunamiMode = isTsunamiPriorityMode();
    return EVACUATION_CANDIDATES
      .filter((item) => item.hazards.includes(hazard) && isShelterOpen(item.id))
      .map((item) => ({
        ...item,
        distance: state.userPosition ? haversine(state.userPosition, { lat: item.position[0], lng: item.position[1] }) : null,
        bearing: state.userPosition ? bearingBetween(state.userPosition, { lat: item.position[0], lng: item.position[1] }) : null,
        rank: candidateRank(item)
      }))
      .sort((a, b) => {
        if (isTsunamiPriorityMode()) {
          const rankDiff = (b.rank || 0) - (a.rank || 0);
          if (Math.abs(rankDiff) > 6) return rankDiff;
        }
        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      });
  }

  function renderCandidates() {
    const candidates = getFilteredCandidates();
    renderCandidateList(candidates);
    renderCandidateMarkers(state.userPosition ? candidates : []);
  }

  function renderCandidateList(candidates = getFilteredCandidates()) {
    el('candidateCount').textContent = state.userPosition ? String(candidates.length) : '0';
    const list = el('candidateList');

    if (!state.userPosition) {
      list.innerHTML = '<div class="empty-state">現在地を取得すると候補を表示します。</div>';
      return;
    }
    if (!candidates.length) {
      list.innerHTML = '<div class="empty-state">該当する候補がありません。</div>';
      return;
    }

    list.innerHTML = candidates.map((candidate, index) => `
      <article class="candidate-item ${state.selectedCandidateId === candidate.id ? 'is-selected' : ''}">
        <div class="candidate-title-line"><h4>${escapeHtml(candidate.name[state.lang])}</h4><div class="candidate-badges"><span class="open-badge">開設</span>${index === 0 && isTsunamiPriorityMode() ? '<span class="priority-badge">有力候補</span>' : ''}</div></div>
        <p>${escapeHtml(candidate.label[state.lang])}</p>
        <p class="official-type">${escapeHtml(candidate.officialType)} / ${escapeHtml(candidate.source)}</p>
        <div class="direction-info"><span class="direction-arrow" style="--bearing:${Math.round(candidate.bearing)}deg">↑</span>${bearingLabel(candidate.bearing, state.lang)}・直線 ${formatDistance(candidate.distance)}・徒歩約${Math.max(1, Math.ceil(candidate.distance / 75))}分</div>
        <div class="candidate-actions">
          <button class="focus-button" type="button" data-action="focus" data-id="${candidate.id}">${I18N[state.lang].focus}</button>
          <button class="route-button" type="button" data-action="route" data-id="${candidate.id}" ${state.routeLoading ? 'disabled' : ''}>${I18N[state.lang].route}</button>
        </div>
      </article>`).join('');

    list.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const candidate = EVACUATION_CANDIDATES.find((item) => item.id === button.dataset.id);
      if (button.dataset.action === 'focus') focusCandidate(candidate);
      else showRoute(candidate);
    }));
  }

  function createCandidatePopup(candidate) {
    const wrapper = document.createElement('div');
    wrapper.className = 'candidate-popup';

    const title = document.createElement('strong');
    title.textContent = candidate.name[state.lang];
    wrapper.appendChild(title);

    const description = document.createElement('p');
    description.textContent = candidate.label[state.lang];
    wrapper.appendChild(description);

    const routeButton = document.createElement('button');
    routeButton.type = 'button';
    routeButton.className = 'popup-route-button';
    routeButton.textContent = I18N[state.lang].route;
    routeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.map.closePopup();
      showRoute(candidate);
    });
    wrapper.appendChild(routeButton);
    return wrapper;
  }

  function renderCandidateMarkers(candidates) {
    if (!state.map) return;
    state.candidateMarkers.forEach(({ marker }) => marker.remove());
    state.candidateMarkers = candidates.map((candidate, index) => {
      const marker = L.marker(candidate.position, { icon: markerIcon(index + 1, candidate.type) }).addTo(state.map);
      marker.bindPopup(createCandidatePopup(candidate), {
        autoClose: true,
        closeOnClick: true,
        closeButton: true,
        className: 'candidate-leaflet-popup'
      });
      marker.on('click', () => {
        state.selectedCandidateId = candidate.id;
        renderCandidateList(candidates);
      });
      return { id: candidate.id, marker };
    });
  }


  function safePointIcon(category) {
    let label = '高';
    let colorClass = 'high';
    if (category.includes('ビル')) {
      label = 'ビ';
      colorClass = 'building';
    } else if (category.includes('空地')) {
      label = '空';
      colorClass = 'open';
    }
    return L.divIcon({
      className: 'safe-point-pin-shell',
      html: `<span class="safe-point-pin ${colorClass}">${label}</span>`,
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16]
    });
  }

  function estimatedWalk(point) {
    if (!state.userPosition) return null;
    const distance = haversine(state.userPosition, { lat: point.position[0], lng: point.position[1] });
    const routeDistance = distance * 1.28;
    const minutes = Math.max(1, Math.round(routeDistance / 67));
    const arrival = new Date(Date.now() + minutes * 60000);
    return { distance, minutes, arrival };
  }

  function formatArrival(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function createSafePointPopup(point) {
    const info = estimatedWalk(point);
    const wrapper = document.createElement('div');
    wrapper.className = 'candidate-popup safe-point-popup';

    const title = document.createElement('strong');
    title.textContent = point.name;
    wrapper.appendChild(title);

    const detail = document.createElement('p');
    detail.textContent = `${point.category} / ${point.area}`;
    wrapper.appendChild(detail);

    const eta = document.createElement('p');
    eta.className = 'safe-point-eta';
    eta.textContent = info ? `現在地から ${formatDistance(info.distance)} / 約${info.minutes}分 / ${formatArrival(info.arrival)}着` : '現在地取得後に到着目安を表示します';
    wrapper.appendChild(eta);

    const routeButton = document.createElement('button');
    routeButton.type = 'button';
    routeButton.className = 'popup-route-button';
    routeButton.textContent = I18N[state.lang].route;
    routeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.map.closePopup();
      showRoute({ id: point.id, name: { ja: point.name, en: point.name, zh: point.name }, position: point.position, type: 'high-ground', officialType: point.category, label: { ja: point.category, en: point.category, zh: point.category }, hazards: ['none', 'tsunami', 'flood', 'inland', 'hightide', 'landslide'] });
    });
    wrapper.appendChild(routeButton);
    return wrapper;
  }

  function renderSafePointMarkers() {
    if (!state.map) return;
    state.safePointMarkers.forEach(({ marker }) => marker.remove());
    state.safePointMarkers = [];
    if (!state.safePointLayerVisible) return;
    state.safePointMarkers = TSUNAMI_SAFE_POINTS.map((point) => {
      const marker = L.marker(point.position, { icon: safePointIcon(point.category), zIndexOffset: 250 }).addTo(state.map);
      marker.bindPopup(createSafePointPopup(point), { autoClose: true, closeOnClick: true, closeButton: true, className: 'candidate-leaflet-popup' });
      return { id: point.id, marker };
    });
  }

  function renderSafePointList() {
    const list = el('safePointList');
    if (!list) return;
    if (!state.userPosition) {
      list.innerHTML = '<div class="empty-state">現在地を取得すると到着目安を表示します。</div>';
      return;
    }
    const items = TSUNAMI_SAFE_POINTS
      .map((point) => ({ ...point, walk: estimatedWalk(point) }))
      .sort((a, b) => (a.walk?.minutes || Infinity) - (b.walk?.minutes || Infinity));
    list.innerHTML = items.map((point) => `
      <article class="safe-point-item">
        <div>
          <strong>${escapeHtml(point.name)}</strong>
          <span>${escapeHtml(point.category)} / ${escapeHtml(point.area)}</span>
        </div>
        <div class="safe-point-time">
          <b>${point.walk ? `約${point.walk.minutes}分` : '-'}</b>
          <small>${point.walk ? `${formatDistance(point.walk.distance)} / ${formatArrival(point.walk.arrival)}着` : '現在地未取得'}</small>
        </div>
      </article>
    `).join('');
  }

  function refreshSafePoints() {
    renderSafePointMarkers();
    renderSafePointList();
  }

  function focusCandidate(candidate) {
    if (!candidate || !state.map) return;
    state.selectedCandidateId = candidate.id;
    state.map.setView(candidate.position, 16);
    renderCandidateList(getFilteredCandidates());
    const markerEntry = state.candidateMarkers.find((item) => item.id === candidate.id);
    if (markerEntry) markerEntry.marker.openPopup();
    el('routeSummary').textContent = candidate.name[state.lang];
  }

  async function showRoute(candidate) {
    if (!state.userPosition) {
      useOfflineSavedPosition('保存済み現在地');
      if (!state.userPosition) {
        showToast('先に現在地を取得してください。オフラインでは保存済み現在地が必要です。');
        return;
      }
    }

    const destination = { lat: candidate.position[0], lng: candidate.position[1] };
    if (state.routeLoading) return;

    clearRoute();
    state.selectedCandidateId = candidate.id;
    state.routeLoading = true;
    setRoutingState('loading', '安全性を確認しながら最短徒歩ルートを計算中…');
    renderCandidateList(getFilteredCandidates());

    try {
      let result;
      if (!navigator.onLine) {
        result = findNearbySavedRoute(candidate.id, state.userPosition);
        if (!result) {
          showOfflineRouteUnavailable(candidate);
          return;
        }
      } else {
        result = await getPedestrianRoute(state.userPosition, destination, candidate.id);
        persistRouteCache();
      }

      state.routeLine = L.polyline(result.coordinates, { color: '#c92f28', weight: 6, opacity: 0.94, lineJoin: 'round', lineCap: 'round' }).addTo(state.map);
      state.map.fitBounds(state.routeLine.getBounds(), { padding: [44, 44], maxZoom: 15 });

      const minutes = Math.max(1, Math.round(result.duration / 60));
      el('routeSummary').textContent = `${formatDistance(result.distance)} / 約${minutes}分`;
      setRoutingState('success', `安全優先最短ルート：${formatDistance(result.distance)}・約${minutes}分`);
      showToast(navigator.onLine ? '道路に沿った徒歩ルートを赤線で表示しました。' : '保存済みの徒歩ルートを赤線で表示しました。');
    } catch (error) {
      console.error(error);
      clearRoute();
      showOfflineRouteUnavailable(candidate);
    } finally {
      state.routeLoading = false;
      renderCandidateList(getFilteredCandidates());
    }
  }

  function routeCacheKey(from, to, candidateId = 'unknown') {
    return `${candidateId}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  }

  function findNearbySavedRoute(candidateId, from) {
    let best = null;
    for (const value of state.routeCache.values()) {
      if (value.candidateId !== candidateId || !value.from) continue;
      const distance = haversine(from, value.from);
      if (distance <= 1200 && (!best || distance < best.distance)) best = { distance, value };
    }
    return best?.value || null;
  }

  async function getPedestrianRoute(from, to, candidateId) {
    const key = routeCacheKey(from, to, candidateId);
    if (state.routeCache.has(key)) return state.routeCache.get(key);

    if (!navigator.onLine) {
      const saved = findNearbySavedRoute(candidateId, from);
      if (saved) return saved;
      throw new Error('No offline route is available.');
    }

    const direct = await fetchRouteWithFallback(from, to, []);
    direct.risk = routeRiskScore(direct.coordinates);
    direct.planName = '最短直接徒歩';
    direct.waypoints = [];

    const results = [direct];
    const directDistance = direct.distance;

    if (directDistance > 2500 || state.reports.length || state.congestionDemo || state.transportDisruption) {
      const plans = createSafeRoutePlans(from, to, directDistance);
      for (const plan of plans) {
        try {
          const result = await fetchRouteWithFallback(from, to, plan.waypoints);
          result.risk = routeRiskScore(result.coordinates);
          result.planName = plan.name;
          result.waypoints = plan.waypoints;
          results.push(result);
        } catch (error) {
          continue;
        }
      }
    }

    const maxDistance = Math.max(directDistance * 1.8, directDistance + 1500);
    const reasonable = results.filter((result) => result.distance <= maxDistance);
    const usable = reasonable.length ? reasonable : [direct];
    const minimumRisk = Math.min(...usable.map((result) => result.risk));
    const riskTolerance = selectedHazards().length ? 90 : 0;
    const safeEnough = usable.filter((result) => result.risk <= minimumRisk + riskTolerance);
    safeEnough.sort((a, b) => (a.distance - b.distance) || (a.duration - b.duration));
    const best = safeEnough[0] || direct;

    const stored = {
      ...best,
      candidateId,
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
      savedAt: Date.now()
    };
    state.routeCache.set(key, stored);
    persistRouteCache();
    return stored;
  }

  async function fetchRouteWithFallback(from, to, waypoints = []) {
    try {
      return await fetchValhallaRoute(from, to, waypoints);
    } catch (primaryError) {
      return await fetchFossgisFootRoute(from, to, waypoints);
    }
  }

  function createSafeRoutePlans(from, to, directDistance) {
    const plans = [];
    const fromIsOutsideKamakura = !isInsideBounds(from, KAMAKURA_BOUNDS_COORDS);
    const destinationWest = to.lng < 139.535;
    const hazards = selectedHazards();

    const addPlan = (name, waypoints) => {
      let estimated = 0;
      let previous = from;
      waypoints.forEach((point) => {
        estimated += haversine(previous, point);
        previous = point;
      });
      estimated += haversine(previous, to);
      const maximum = Math.max(directDistance * 1.8, directDistance + 1500);
      if (estimated <= maximum) plans.push({ name, waypoints });
    };

    if (fromIsOutsideKamakura || directDistance > 12000) {
      addPlan('大船方面経由', [SAFE_ROUTE_WAYPOINTS.ofuna]);
      addPlan('大船・北鎌倉経由', [SAFE_ROUTE_WAYPOINTS.ofuna, SAFE_ROUTE_WAYPOINTS.kitaKamakura]);
    } else if (directDistance > 3500) {
      if (destinationWest) {
        addPlan('笛田方面回避経由', [SAFE_ROUTE_WAYPOINTS.fuedaNorth]);
      } else {
        addPlan('八幡宮北側経由', [SAFE_ROUTE_WAYPOINTS.hachimanguNorth]);
      }
      if (hazards.includes('flood') || hazards.includes('inland')) {
        addPlan('河川回避・北側経由', [SAFE_ROUTE_WAYPOINTS.kitaKamakura]);
      }
    }

    const directStart = { lat: from.lat, lng: from.lng };
    const directEnd = { lat: to.lat, lng: to.lng };
    state.reports.forEach((report) => {
      const distance = distanceToSegmentMeters({ lat: report.lat, lng: report.lng }, directStart, directEnd);
      if (distance < 500 && directDistance > 700) {
        addPlan('通行不可地点の北側回避', [{ lat: report.lat + 0.0032, lng: report.lng }]);
        addPlan('通行不可地点の西側回避', [{ lat: report.lat, lng: report.lng - 0.0032 }]);
      }
    });
    if (state.congestionDemo && directDistance > 1000) {
      CONGESTION_ZONES.forEach((zone) => {
        const center = { lat: zone.center[0], lng: zone.center[1] };
        if (distanceToSegmentMeters(center, directStart, directEnd) < zone.radius + 220) {
          addPlan('混雑回避経由', [{ lat: center.lat + 0.0030, lng: center.lng - 0.0020 }]);
        }
      });
    }
    if (state.transportDisruption && directDistance > 800) {
      const station = { lat: 35.3193, lng: 139.5504 };
      if (distanceToSegmentMeters(station, directStart, directEnd) < 420) {
        addPlan('鎌倉駅周辺回避', [{ lat: 35.3224, lng: 139.5464 }]);
        addPlan('駅東側回避', [{ lat: 35.3221, lng: 139.5560 }]);
      }
    }

    return dedupeRoutePlans(plans);
  }

  function dedupeRoutePlans(plans) {
    const seen = new Set();
    return plans.filter((plan) => {
      const key = plan.waypoints.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|') || 'direct';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isInsideBounds(point, bounds) {
    return point.lat >= bounds[0][0] && point.lat <= bounds[1][0] && point.lng >= bounds[0][1] && point.lng <= bounds[1][1];
  }

  function routeRiskScore(coordinates) {
    const hazards = selectedHazards();
    const samples = coordinates.filter((_, index) => index % 3 === 0);
    if (!samples.length) return 0;

    let score = 0;
    ROUTE_RISK_ZONES.forEach((zone) => {
      if (!zone.hazards.some((hazard) => hazards.includes(hazard))) return;
      const inside = samples.filter(([lat, lng]) => {
        return lat >= zone.bounds[0][0] && lat <= zone.bounds[1][0] && lng >= zone.bounds[0][1] && lng <= zone.bounds[1][1];
      }).length;
      if (inside) score += zone.weight * (inside / samples.length);
    });

    if (hazards.includes('flood') || hazards.includes('inland')) score += riverAvoidScore(coordinates);
    score += reportRoutePenalty(coordinates);
    score += congestionRoutePenalty(coordinates);
    if (state.transportDisruption) score += stationRoutePenalty(coordinates);
    return score;
  }

  function riverAvoidScore(coordinates) {
    const samples = coordinates.filter((_, index) => index % 3 === 0);
    if (!samples.length) return 0;

    let accumulated = 0;
    samples.forEach(([lat, lng]) => {
      let pointScore = 0;
      RIVER_AVOID_SEGMENTS.forEach((river) => {
        const distance = distanceToSegmentMeters({ lat, lng }, river.start, river.end);
        if (distance < 80) pointScore = Math.max(pointScore, river.weight * 3);
        else if (distance < 160) pointScore = Math.max(pointScore, river.weight * 1.7);
        else if (distance < 260) pointScore = Math.max(pointScore, river.weight * 0.7);
      });
      accumulated += pointScore;
    });
    return accumulated / samples.length * 12;
  }

  function routeClarityScore(coordinates) {
    const majorCorridors = [
      [[35.3330, 139.5400], [35.3520, 139.5320]],
      [[35.3180, 139.5500], [35.3380, 139.5460]],
      [[35.3160, 139.5450], [35.3270, 139.5560]],
      [[35.3050, 139.5300], [35.3210, 139.5480]]
    ];
    let score = 0;
    coordinates.forEach(([lat, lng], index) => {
      if (index % 5 !== 0) return;
      const nearMajor = majorCorridors.some(([a, b]) => distanceToSegmentMeters({ lat, lng }, { lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) < 260);
      if (!nearMajor) score += 1;
    });
    return score;
  }

  function reportRoutePenalty(coordinates) {
    if (!state.reports.length) return 0;
    let penalty = 0;
    state.reports.forEach((report) => {
      let nearest = Infinity;
      coordinates.forEach(([lat, lng], index) => {
        if (index % 3 !== 0) return;
        nearest = Math.min(nearest, haversine({ lat, lng }, { lat: report.lat, lng: report.lng }));
      });
      if (nearest < 70) penalty += 1800;
      else if (nearest < 140) penalty += 700;
    });
    return penalty;
  }

  function congestionRoutePenalty(coordinates) {
    if (!state.congestionDemo) return 0;
    let penalty = 0;
    CONGESTION_ZONES.forEach((zone) => {
      let inside = 0;
      let total = 0;
      coordinates.forEach(([lat, lng], index) => {
        if (index % 3 !== 0) return;
        total += 1;
        if (haversine({ lat, lng }, { lat: zone.center[0], lng: zone.center[1] }) < zone.radius) inside += 1;
      });
      if (total) penalty += (inside / total) * zone.level * 480;
    });
    return penalty;
  }

  function stationRoutePenalty(coordinates) {
    const station = { lat: 35.3193, lng: 139.5504 };
    let nearest = Infinity;
    coordinates.forEach(([lat, lng], index) => {
      if (index % 3 !== 0) return;
      nearest = Math.min(nearest, haversine({ lat, lng }, station));
    });
    return nearest < 230 ? 800 : nearest < 400 ? 260 : 0;
  }

  function distanceToSegmentMeters(point, start, end) {
    const x = point.lng;
    const y = point.lat;
    const x1 = start.lng;
    const y1 = start.lat;
    const x2 = end.lng;
    const y2 = end.lat;
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return haversine(point, start);
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const projected = { lat: y1 + t * dy, lng: x1 + t * dx };
    return haversine(point, projected);
  }

  async function fetchValhallaRoute(from, to, waypoints = []) {
    const locations = [from, ...waypoints, to].map((point) => ({ lat: point.lat, lon: point.lng, type: 'break' }));
    const payload = {
      locations,
      costing: 'pedestrian',
      costing_options: { pedestrian: { shortest: true, use_ferry: 0, alley_factor: 3, driveway_factor: 4 } },
      units: 'kilometers',
      directions_options: { units: 'kilometers', language: state.lang === 'ja' ? 'ja-JP' : state.lang === 'zh' ? 'zh-CN' : 'en-US' }
    };
    const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(payload))}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Valhalla HTTP ${response.status}`);
    const data = await response.json();
    const legs = data?.trip?.legs || [];
    const summary = data?.trip?.summary;
    if (!legs.length || !summary) throw new Error('Valhalla route data is incomplete.');
    const coordinates = legs.flatMap((leg, index) => {
      const decoded = decodePolyline(leg.shape, 6);
      return index === 0 ? decoded : decoded.slice(1);
    });
    return {
      coordinates,
      distance: Number(summary.length) * 1000,
      duration: Number(summary.time),
      provider: 'Valhalla pedestrian'
    };
  }

  async function fetchFossgisFootRoute(from, to, waypoints = []) {
    const points = [from, ...waypoints, to];
    const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordinates}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`FOSSGIS OSRM HTTP ${response.status}`);
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates) throw new Error('FOSSGIS route data is incomplete.');
    return {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distance: Number(route.distance),
      duration: Number(route.duration),
      provider: 'FOSSGIS OSRM foot'
    };
  }

  function decodePolyline(encoded, precision = 6) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    const factor = 10 ** precision;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);

      coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
  }

  function setRoutingState(type, message) {
    const node = el('routingState');
    node.className = `route-service-label${type ? ` ${type}` : ''}`;
    node.textContent = message;
  }

  function clearRoute() {
    if (state.routeLine) {
      state.routeLine.remove();
      state.routeLine = null;
    }
    state.selectedCandidateId = null;
    el('routeSummary').textContent = I18N[state.lang].notSelected;
    setRoutingState('', state.lang === 'ja' ? '安全優先徒歩ルート：未計算' : state.lang === 'zh' ? '步行路线：未计算' : 'Walking route: not calculated');
  }

  function updateGuidance() {
    const config = HAZARD_CONFIG[primaryHazard()];
    el('guidanceIcon').textContent = config.icon;
    el('guidanceTag').textContent = config.label[state.lang];
    el('guidanceHeading').textContent = config.heading[state.lang];
    el('guidanceText').textContent = config.text[state.lang];
    renderHazardLayer();
  }

  function updateHazardOptions() {
    document.querySelectorAll('[data-hazard-label]').forEach((node) => {
      const config = HAZARD_CONFIG[node.dataset.hazardLabel];
      if (config) node.textContent = config.label[state.lang];
    });
  }

  function setLanguage(lang) {
    state.lang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      if (I18N[lang][key]) node.textContent = I18N[lang][key];
    });
    document.querySelectorAll('.language-button').forEach((button) => button.classList.toggle('is-active', button.dataset.lang === lang));
    el('trackButton').textContent = state.watchId === null ? I18N[lang].startTracking : I18N[lang].stopTracking;
    updateHazardOptions();
    updateGuidance();
    renderCandidates();
    refreshSafePoints();
    renderTransportStatus();
    renderReports();
    renderNotifications();
    renderAdmin();
    renderOfflineMetrics();
    if (!state.routeLine) clearRoute();
  }

  function useDemoPosition(key) {
    const demo = DEMO_POSITIONS[key];
    setUserPosition(demo.lat, demo.lng, 0, demo.label, false);
    showToast(`${demo.label}を現在地として設定しました。`);
  }

  function resetMap() {
    if (!state.map) return;
    clearRoute();
    state.map.fitBounds(L.latLngBounds(KAMAKURA_BOUNDS_COORDS), { padding: [12, 12] });
    setTimeout(() => state.map.invalidateSize(), 50);
  }

  function updateNetworkState() {
    const online = navigator.onLine;
    el('networkState').textContent = online ? 'オンライン' : 'オフライン';
    el('networkState').className = online ? 'state-chip' : 'state-chip offline';
    el('mapModeLabel').textContent = online ? 'OpenStreetMap＋ハザードマップポータルサイト' : '保存済み地図・ハザード・経路で動作中';
    if (!online) showToast('オフラインです。保存済みの地図範囲と経路を使用します。');
  }

  function haversine(a, b) {
    const rad = (d) => d * Math.PI / 180;
    const R = 6371000;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function bearingBetween(a, b) {
    const rad = (d) => d * Math.PI / 180;
    const deg = (r) => r * 180 / Math.PI;
    const phi1 = rad(a.lat);
    const phi2 = rad(b.lat);
    const deltaLambda = rad(b.lng - a.lng);
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }


  function bearingLabel(value, lang) {
    const dirs = {
      ja: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
      en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      zh: ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
    };
    return dirs[lang][Math.round(value / 45) % 8];
  }

  function formatDistance(meters) {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  let toastTimer;
  function showToast(message) {
    const toast = el('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
  }

  function restoreSavedState() {
    const savedHazards = loadHazardSelection();
    if (savedHazards) {
      document.querySelectorAll('input[name="hazardLayer"]').forEach((input) => {
        input.checked = savedHazards.includes(input.value);
      });
      state.activeHazard = savedHazards[0] || 'none';
      updateGuidance();
    }

    const saved = loadSavedPosition();
    if (saved && isInsideBounds({ lat: saved.lat, lng: saved.lng }, KAMAKURA_BOUNDS_COORDS)) {
      setUserPosition(saved.lat, saved.lng, saved.accuracy || 0, '保存済み現在地', false);
      const date = saved.savedAt ? new Date(saved.savedAt).toLocaleString('ja-JP') : '';
      el('locationMessage').textContent = `保存済みの現在地を表示しています${date ? `（${date}）` : ''}。GPSの許可画面は表示していません。`;
    } else {
      resetMap();
      useOfflineSavedPosition('保存済み現在地');
      el('routeSummary').textContent = '未選択';
    }
  }

  async function cacheEvacuationRoutesForOffline() {
    if (!state.userPosition || !navigator.onLine) return 0;
    const candidates = getFilteredCandidates().slice(0, 12);
    let savedCount = 0;
    for (const candidate of candidates) {
      const destination = { lat: candidate.position[0], lng: candidate.position[1] };
      try {
        await getPedestrianRoute(state.userPosition, destination, candidate.id);
        savedCount += 1;
      } catch (error) {
        continue;
      }
    }
    persistRouteCache();
    return savedCount;
  }

  async function cacheVisibleMapTiles() {
    if (!('caches' in window)) return 0;
    const urls = Array.from(document.querySelectorAll('#map img.leaflet-tile'))
      .map((image) => image.currentSrc || image.src)
      .filter((url) => url && (url.includes('tile.openstreetmap.org') || url.includes('disaportaldata.gsi.go.jp')));
    const uniqueUrls = Array.from(new Set(urls));
    const cache = await caches.open('kamakura-disaster-tile-cache-v13-corrected');
    let saved = 0;
    await Promise.all(uniqueUrls.map(async (url) => {
      try {
        const response = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        await cache.put(url, response);
        saved += 1;
      } catch (error) {
        return null;
      }
      return null;
    }));
    return saved;
  }

  async function prepareOfflineView() {
    if (location.protocol === 'file:') {
      showToast('オフライン機能は start_server.bat から起動した場合に利用できます。');
      return;
    }
    persistHazardSelection();
    persistRouteCache();
    if (state.userPosition && !String(state.userPosition.label).includes('デモ')) savePosition(state.userPosition);
    setRoutingState('loading', 'オフライン用の地図と道路ルートを保存中…');
    const routeCount = await cacheEvacuationRoutesForOffline();
    const tileCount = await cacheVisibleMapTiles();
    setRoutingState('success', `オフライン保存：道路ルート${routeCount}件・地図${tileCount}件`);
    showToast(`オフライン用に道路ルート${routeCount}件と表示中の地図${tileCount}件を保存しました。`);
  }


  function reportTypeLabel(type) {
    const labels = {
      blocked: { ja: '通行不可', en: 'Blocked road', zh: '道路封闭' },
      flooded: { ja: '道路冠水', en: 'Flooded road', zh: '道路积水' },
      debris: { ja: '倒木・瓦礫', en: 'Debris', zh: '倒木・瓦砾' },
      crowded: { ja: '著しい混雑', en: 'Severe crowding', zh: '严重拥堵' }
    };
    return labels[type]?.[state.lang] || labels.blocked[state.lang];
  }

  function renderTransportStatus() {
    const list = el('transportList');
    if (!list) return;
    list.innerHTML = TRANSPORT_SERVICES.map((service) => {
      const status = state.transportDisruption ? service.disaster[state.lang] : service.normal[state.lang];
      const level = state.transportDisruption ? (service.id === 'enoden' ? 'stop' : 'delay') : 'normal';
      return `<article class="transport-card"><div class="transport-line"><h3>${escapeHtml(service.name[state.lang])}</h3><span class="transport-status ${level}">${escapeHtml(status)}</span></div><p>${state.transportDisruption ? (state.lang === 'ja' ? '駅への集中を避け、避難先への徒歩移動を優先します。' : state.lang === 'en' ? 'Avoid station concentration and prioritize evacuation on foot.' : '避免人员集中到车站，优先步行避难。') : (state.lang === 'ja' ? '現在は通常運行のデモ状態です。' : state.lang === 'en' ? 'Demo status: normal service.' : '演示状态：正常运行。')}</p></article>`;
    }).join('');
  }

  function renderReports() {
    const list = el('reportList');
    if (list) {
      if (!state.reports.length) {
        list.innerHTML = '<div class="empty-state">登録された通行不可情報はありません。</div>';
      } else {
        list.innerHTML = state.reports.slice().reverse().map((report) => `<article class="report-item"><div><strong>${escapeHtml(reportTypeLabel(report.type))}</strong><p>${escapeHtml(report.note || '補足なし')} / ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</p></div><button class="report-delete" type="button" data-report-delete="${report.id}">削除</button></article>`).join('');
        list.querySelectorAll('[data-report-delete]').forEach((button) => button.addEventListener('click', () => {
          state.reports = state.reports.filter((report) => report.id !== button.dataset.reportDelete);
          saveJson(REPORTS_KEY, state.reports);
          mirrorReportsToIndexedDb();
          renderReports();
          renderOperationalLayers();
          clearRoute();
        }));
      }
    }
    renderOperationalLayers();
  }

  function reportMarkerIcon() {
    return L.divIcon({ className: 'report-pin-shell', html: '<span class="report-pin">!</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
  }

  function renderOperationalLayers() {
    if (!state.map || typeof L === 'undefined') return;
    state.reportMarkers.forEach((marker) => state.map.removeLayer(marker));
    state.congestionLayers.forEach((layer) => state.map.removeLayer(layer));
    state.reportMarkers = [];
    state.congestionLayers = [];

    state.reports.forEach((report) => {
      const marker = L.marker([report.lat, report.lng], { icon: reportMarkerIcon(), zIndexOffset: 850 }).addTo(state.map);
      marker.bindPopup(`<strong>${escapeHtml(reportTypeLabel(report.type))}</strong><br>${escapeHtml(report.note || '補足なし')}`);
      state.reportMarkers.push(marker);
    });

    if (state.congestionDemo) {
      CONGESTION_ZONES.forEach((zone) => {
        const color = zone.level >= 3 ? '#c9362d' : '#d79525';
        const layer = L.circle(zone.center, { radius: zone.radius, color, weight: 2, fillColor: color, fillOpacity: 0.12 }).addTo(state.map);
        layer.bindTooltip(`${zone.name}・混雑デモ`);
        state.congestionLayers.push(layer);
      });
    }
  }

  function renderAdmin() {
    const list = el('adminShelterList');
    if (!list) return;
    list.innerHTML = EVACUATION_CANDIDATES.map((candidate) => `<article class="admin-shelter-item"><div><strong>${escapeHtml(candidate.name.ja)}</strong><small>${escapeHtml(candidate.officialType)} / ${escapeHtml(candidate.label.ja)}</small></div><label class="admin-switch"><input type="checkbox" data-shelter-id="${candidate.id}" ${isShelterOpen(candidate.id) ? 'checked' : ''}>開設</label></article>`).join('');
    list.querySelectorAll('[data-shelter-id]').forEach((input) => input.addEventListener('change', () => {
      state.shelterStatus[input.dataset.shelterId] = input.checked;
      saveJson(SHELTER_STATUS_KEY, state.shelterStatus);
      mirrorSheltersToIndexedDb();
      renderCandidates();
      renderAdmin();
    }));
    const openCount = EVACUATION_CANDIDATES.filter((candidate) => isShelterOpen(candidate.id)).length;
    if (el('adminSummary')) el('adminSummary').textContent = `開設中 ${openCount}/${EVACUATION_CANDIDATES.length}施設 / 道路混雑デモ ${state.congestionDemo ? 'ON' : 'OFF'} / 利用者報告 ${state.reports.length}件`;
  }

  function renderNotifications() {
    const list = el('notificationList');
    if (!list) return;
    const hazard = HAZARD_CONFIG[primaryHazard()];
    const items = [
      { level: 'danger', title: hazard.label[state.lang], text: hazard.heading[state.lang] },
      { level: state.transportDisruption ? 'warning' : 'info', title: state.lang === 'ja' ? '交通機関' : state.lang === 'en' ? 'Transport' : '交通', text: state.transportDisruption ? (state.lang === 'ja' ? '運休・遅延デモ中。駅への集中を避けてください。' : state.lang === 'en' ? 'Disruption demo active. Avoid concentrating at stations.' : '停运・延误演示中，请避免集中到车站。') : (state.lang === 'ja' ? '交通機関は通常運行のデモ状態です。' : state.lang === 'en' ? 'Demo status: normal transport service.' : '演示状态：交通正常运行。') },
      { level: 'info', title: state.lang === 'ja' ? '避難先候補' : state.lang === 'en' ? 'Evacuation options' : '避难候选地点', text: state.lang === 'ja' ? 'GPSと災害種別に応じて候補を更新します。' : state.lang === 'en' ? 'Options update according to GPS location and hazard type.' : '候选地点会根据GPS位置和灾害类型更新。' }
    ];
    list.innerHTML = items.map((item) => `<article class="notification-item ${item.level}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('');
  }

  function renderOfflineMetrics() {
    if (el('offlineNetworkBadge')) el('offlineNetworkBadge').textContent = navigator.onLine ? 'オンライン' : 'オフライン';
    if (!el('offlineMetrics')) return;
    const position = loadSavedPosition();
    el('offlineMetrics').innerHTML = `<strong>端末内保存状況</strong><div>保存済み現在地: ${position ? 'あり' : 'なし'} / 保存済みルート: ${state.routeCache.size}件 / 通行不可報告: ${state.reports.length}件 / Service Worker: ${'serviceWorker' in navigator ? '対応' : '非対応'}</div>`;
  }

  function startTsunamiDemo() {
    useDemoPosition('coast');
    document.querySelectorAll('input[name="hazardLayer"]').forEach((input) => { input.checked = input.value === 'tsunami'; });
    state.activeHazard = 'tsunami';
    state.transportDisruption = true;
    state.congestionDemo = true;
    saveJson(TRANSPORT_KEY, state.transportDisruption);
    saveJson(CONGESTION_KEY, state.congestionDemo);
    clearRoute();
    updateGuidance();
    renderCandidates();
    renderTransportStatus();
    renderNotifications();
    renderAdmin();
    renderOperationalLayers();
    showScreen('map');
    showToast('由比ヶ浜の津波発生デモを開始しました。');
  }


function handleReportSubmit(event) {
  event.preventDefault();

  // GPSで取得した現在地が必要
  const current = state.userPosition;

  if (
    !current ||
    !Number.isFinite(current.lat) ||
    !Number.isFinite(current.lng) ||
    String(current.label || '').includes('デモ')
  ) {
    showToast('GPSで実際の現在地を取得してから投稿してください。');
    return;
  }

  // 報告地点を取得
  const lat = Number(el('reportLat')?.value);
  const lng = Number(el('reportLng')?.value);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 || lat > 90 ||
    lng < -180 || lng > 180
  ) {
    showToast('正しい報告地点を指定してください。');
    return;
  }

  const pin = { lat, lng };
  const travelledMeters = state.reportTrack.slice(1).reduce((sum, point, index) => sum + haversine(state.reportTrack[index], point), 0);
  if (state.reportTrack.length < REPORT_TRACK_MIN_POINTS || travelledMeters < REPORT_TRACK_MIN_DISTANCE_METERS) {
    showToast('投稿前にGPS軌跡を記録しながら少し移動してください（3点以上・約25m以上）。');
    return;
  }

  let nearestTrackDistance = Infinity;
  for (let i = 1; i < state.reportTrack.length; i++) {
    nearestTrackDistance = Math.min(nearestTrackDistance, distanceFromPinToGpsSegmentMeters(pin, state.reportTrack[i - 1], state.reportTrack[i]));
  }
  if (nearestTrackDistance > REPORT_TRACK_BUFFER_METERS) {
    showToast(`投稿地点が記録した軌跡から約${Math.round(nearestTrackDistance)}m離れています。軌跡から50m以内を指定してください。`);
    return;
  }
  const distance = haversine(current, pin);
  // ここから先は従来の投稿処理
  const report = {
    id: `report-${Date.now()}`,
    type: el('reportType')?.value || 'blocked',
    note: el('reportNote')?.value.trim() || '',
    lat,
    lng,
    createdAt: Date.now()
  };

  state.reports.push(report);
  saveJson(REPORTS_KEY, state.reports);
  mirrorReportsToIndexedDb();

  sendReportToFirebase(report);

  el('reportNote').value = '';

  renderReports();
  clearRoute();

  showToast(
    `通行不可情報を登録しました（現在地から約${Math.round(distance)}m）。`
  );
}


    async function sendReportToFirebase(report) {
    if (!firestoreDb) {
      console.error('Firestoreが初期化されていません。');
      showToast('Firebaseに接続できませんでした。');
      return;
    }

    try {
      await firestoreDb.collection('reports').add({
        type: report.type,
        message: report.note || '',
        reportLat: report.lat,
        reportLng: report.lng,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('Firebaseに通行不可情報を保存しました。');
      console.log(report);

    } catch (error) {
      console.error('Firebase保存エラー:', error);
      showToast('Firebaseへの保存に失敗しました。');
    }
  }

  function loadFirebaseReports() {
    if (!firestoreDb) {
      console.warn('Firebase / Firestoreが読み込まれていません。');
      return;
    }

    firestoreDb.collection('reports')
      .where('status', '==', 'approved')
      .onSnapshot(
        (snapshot) => {
          const firebaseReports = [];

          snapshot.forEach((doc) => {
            const data = doc.data();

            if (
              typeof data.reportLat !== 'number' ||
              typeof data.reportLng !== 'number'
            ) {
              return;
            }

            firebaseReports.push({
              id: `firebase-${doc.id}`,
              type: data.type || 'blocked',
              note: data.message || '通行不可情報',
              lat: data.reportLat,
              lng: data.reportLng,
              createdAt: data.createdAt?.toMillis
                ? data.createdAt.toMillis()
                : Date.now()
            });
          });

          // Firebaseから取得した情報だけを入れ替える
          // 既存のローカル報告はそのまま残す
          const localReports = state.reports.filter(
            (report) =>
              !String(report.id).startsWith('firebase-')
          );

          state.reports = [
            ...localReports,
            ...firebaseReports
          ];

          renderReports();
          renderOperationalLayers();
          clearRoute();

          console.log(
            `Firebaseから承認済み報告を${firebaseReports.length}件取得しました。`
          );
        },
        (error) => {
          console.error(
            'Firebase通行不可情報取得エラー:',
            error
          );
        }
      );
  }

  function showOfflineRouteUnavailable(candidate) {
    const saved = state.userPosition ? findNearbySavedRoute(candidate.id, state.userPosition) : null;
    if (saved) {
      state.routeLine = L.polyline(saved.coordinates, { color: '#c92f28', weight: 6, opacity: 0.94, lineJoin: 'round', lineCap: 'round' }).addTo(state.map);
      state.map.fitBounds(state.routeLine.getBounds(), { padding: [44, 44], maxZoom: 15 });
      const minutes = Math.max(1, Math.round(saved.duration / 60));
      el('routeSummary').textContent = `${formatDistance(saved.distance)} / 約${minutes}分`;
      setRoutingState('success', `保存済み徒歩ルート：${formatDistance(saved.distance)}・約${minutes}分`);
      showToast('保存済みの徒歩ルートを赤線で表示しました。');
      return true;
    }
    el('routeSummary').textContent = '保存済みルートなし';
    setRoutingState('error', 'この避難先の徒歩ルートは未保存です');
    showToast('この避難先の徒歩ルートはオンライン中に一度計算してください。');
    return false;
  }

  function resolveScreen(value) {
    return value === 'destinations' ? 'map' : value;
  }

  function screenFocusId(value) {
    const targets = {
      top: 'mapSection',
      map: 'mapSection',
      destinations: 'candidatePanel',
      guidance: 'scenario',
      transport: 'transportSection',
      report: 'reportSection',
      notifications: 'notificationsSection',
      offline: 'offlineSection',
      admin: 'adminSection',
      system: 'systemSection'
    };
    return targets[value] || 'topScreen';
  }

  function showScreen(value, options = {}) {
    const requested = value || 'top';
    const active = resolveScreen(requested);
    document.querySelectorAll('.screen-section').forEach((section) => {
      section.classList.toggle('is-active', section.dataset.screen === active);
    });
    document.querySelectorAll('[data-screen-target]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.screenTarget === requested);
    });
    const menu = el('headerMenu');
    if (menu) menu.open = false;
    const focusId = screenFocusId(requested);
    const target = el(focusId);
    const shouldScroll = options.scroll !== false;
    if (shouldScroll && target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    }
    if (active === 'map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 90);
      setTimeout(() => state.map.invalidateSize(), 350);
    }
  }

  function setupProtocolWarning() {
    const warning = el('localFileWarning');
    if (!warning) return;
    warning.hidden = location.protocol !== 'file:';
    el('closeProtocolWarning')?.addEventListener('click', () => { warning.hidden = true; });
  }

  function setupHeaderMenu() {
    const menu = el('headerMenu');
    if (!menu) return;
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('click', (event) => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  }

  function setupBackToTop() {
    const button = el('backToTopButton');
    if (!button) return;
    const update = () => button.classList.toggle('is-visible', window.scrollY > 500);
    window.addEventListener('scroll', update, { passive: true });
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }

  function bindEvents() {
    el('heroLocateButton').addEventListener('click', () => {
      showScreen('map');
      setTimeout(() => getCurrentPosition({ force: true, recordTrack: true }), 300);
    });
    el('locateButton').addEventListener('click', () => getCurrentPosition({ force: true, recordTrack: true }));
    el('trackButton').addEventListener('click', toggleTracking);
    el('demoStationButton').addEventListener('click', () => useDemoPosition('station'));
    el('demoCoastButton').addEventListener('click', () => useDemoPosition('coast'));
    el('resetMapButton').addEventListener('click', resetMap);
    el('headerGpsButton')?.addEventListener('click', () => getCurrentPosition({ force: true, recordTrack: true }));
    el('headerTopButton')?.addEventListener('click', () => showScreen('map'));
    el('offlinePrepareButton')?.addEventListener('click', prepareOfflineView);
    el('offlinePanelSaveButton')?.addEventListener('click', prepareOfflineView);
    el('scenarioDemoButton')?.addEventListener('click', startTsunamiDemo);
    el('transportDemoButton')?.addEventListener('click', () => {
      state.transportDisruption = !state.transportDisruption;
      saveJson(TRANSPORT_KEY, state.transportDisruption);
      clearRoute();
      renderTransportStatus();
      renderNotifications();
      renderCandidates();
      showToast(state.transportDisruption ? '交通機関の運休デモをONにしました。' : '交通機関の運休デモをOFFにしました。');
    });
    el('congestionDemoButton')?.addEventListener('click', () => {
      state.congestionDemo = !state.congestionDemo;
      saveJson(CONGESTION_KEY, state.congestionDemo);
      clearRoute();
      renderOperationalLayers();
      renderCandidates();
      renderAdmin();
      showToast(state.congestionDemo ? '道路混雑デモをONにしました。' : '道路混雑デモをOFFにしました。');
    });
    el('adminResetButton')?.addEventListener('click', () => {
      state.shelterStatus = {};
      state.reports = [];
      state.congestionDemo = false;
      state.transportDisruption = false;
      saveJson(SHELTER_STATUS_KEY, state.shelterStatus);
      saveJson(REPORTS_KEY, state.reports);
      saveJson(CONGESTION_KEY, state.congestionDemo);
      saveJson(TRANSPORT_KEY, state.transportDisruption);
      mirrorReportsToIndexedDb();
      mirrorSheltersToIndexedDb();
      clearRoute();
      renderReports();
      renderTransportStatus();
      renderNotifications();
      renderAdmin();
      renderCandidates();
      renderOperationalLayers();
      showToast('デモ状態を初期化しました。');
    });
    el('reportForm')?.addEventListener('submit', handleReportSubmit);
    el('reportUseCurrentButton')?.addEventListener('click', async () => {
      await getCurrentPosition({ force: true, recordTrack: true });
      if (!state.reportTrackActive || !state.userPosition || String(state.userPosition.label || '').includes('デモ')) return;
      el('reportLat').value = state.userPosition.lat.toFixed(6);
      el('reportLng').value = state.userPosition.lng.toFixed(6);
      showToast('現在地を報告地点に設定し、GPS軌跡の記録を開始しました。');
    });
    el('reportPickMapButton')?.addEventListener('click', () => {
      state.reportPickMode = true;
      showScreen('map');
      showToast('地図上の報告地点をクリックしてください。');
    });
    el('safePointToggle')?.addEventListener('change', (event) => { state.safePointLayerVisible = event.target.checked; refreshSafePoints(); });
    document.querySelectorAll('input[name="hazardLayer"]').forEach((input) => input.addEventListener('change', () => {
      if (input.checked) state.activeHazard = input.value;
      clearRoute();
      updateGuidance();
      renderCandidates();
      persistHazardSelection();
    }));
    el('clearHazardsButton').addEventListener('click', () => {
      document.querySelectorAll('input[name="hazardLayer"]').forEach((input) => { input.checked = false; });
      state.activeHazard = 'none';
      clearRoute();
      updateGuidance();
      renderCandidates();
      persistHazardSelection();
    });
    document.querySelectorAll('[data-screen-target]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screenTarget)));
    document.querySelectorAll('.language-button').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
    window.addEventListener('online', () => { updateNetworkState(); renderOfflineMetrics(); });
    window.addEventListener('offline', () => { updateNetworkState(); renderOfflineMetrics(); });
    window.addEventListener('resize', () => state.map && state.map.invalidateSize());
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    setupProtocolWarning();
    setupHeaderMenu();
    setupBackToTop();
    initMap();
    showScreen('map', { scroll: false });
    setLanguage('ja');
    restoreSavedState();
    renderCandidates();
    refreshSafePoints();
    renderTransportStatus();
    renderReports();
    renderNotifications();
    renderAdmin();
    renderOfflineMetrics();

    // Firebaseから承認済みの通行不可情報を取得
    loadFirebaseReports();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId);
    state.reportTrackActive = false;
    state.reportTrack = [];
  });
})();
