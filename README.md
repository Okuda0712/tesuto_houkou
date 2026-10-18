# kamakura-site-v14

7_24発表スライドの要件を再確認して構成した授業発表用プロトタイプです。

## 実装済み

- Geolocation APIによる現在地取得
- Leaflet + OpenStreetMap
- 津波・洪水・内水・高潮・土砂災害ハザード表示
- 災害種別に応じた避難先候補
- Valhalla / OSRM系サービスによる徒歩ルート
- 安全性と距離を考慮したルート評価
- 日本語・英語・中国語切替
- 初期行動支援
- 交通機関運行情報のデモ表示
- 通行不可地点の投稿試作
- 道路混雑デモ
- 避難所開設ON/OFFの管理者デモ
- 通知・警告画面
- Service Worker / PWA
- Local StorageとIndexedDBへの試作データ保存

## 設計・技術検証段階

- ODPTなど実運行情報APIとの本接続
- 気象庁XMLによる自動防災モード切替
- Flask + MySQLの本番バックエンド
- GraphHopperによる完全オフライン新規経路探索
- 実利用者GPSを集計した混雑判定
- 管理者による投稿承認フロー

## 起動

Windowsでは start_server.bat または start_server.cmd を実行して、表示されたURLをブラウザで開いてください。
