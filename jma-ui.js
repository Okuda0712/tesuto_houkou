(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const set = (text) => { $('jmaTestResult').textContent = text; };
  async function json(url, options) {
    const res = await fetch(url, {cache:'no-store', ...options});
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const raw = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  async function registerPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('このブラウザではPush通知を利用できません。HTTPSで開いてください。');
    if (!window.isSecureContext) throw new Error('Push通知にはHTTPSが必要です。');
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('通知が許可されていません。');
    }
    const reg = await navigator.serviceWorker.register('./sw.js');
    const ready = await navigator.serviceWorker.ready;
    const {publicKey} = await json('./api/push/public-key');
    let sub = await ready.pushManager.getSubscription();
    if (!sub) sub = await ready.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey)});
    await json('./api/push/subscribe', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({subscription:sub.toJSON(), test:true})});
    set('この端末をPush通知の受信先として登録しました。');
  }
  async function refresh() {
    try {
      const result = await json('./api/jma/status');
      $('jmaStatus').textContent = `公式フィード: ${result.real.status} / 最終確認: ${result.real.checked_at || '未実施'} / 監視間隔: ${result.poll_seconds}秒`;
      if (result.test) $('jmaLastTest').textContent = `最終テスト: ${result.test.fixture} / 対象: ${result.test.bulletin.target} / 判定: ${result.test.decision || '不明'} / 理由: ${result.test.reason || '-'} / 重複: ${result.test.duplicate ? 'はい' : 'いいえ'} / 送信成功: ${result.test.push.sent}件 / 失敗: ${result.test.push.failed}件`;
    } catch (e) { $('jmaStatus').textContent = 'JMA監視サーバーに接続できません。server.pyで起動してください。'; }
  }
  async function adminPost(url, data) {
    const admin = $('jmaAdminToken').value.trim();
    if (!admin) throw new Error('PC内のadmin_token.txtにある管理者トークンを入力してください。');
    return json(url, {method:'POST', headers:{'Content-Type':'application/json', 'X-Admin-Token':admin}, body:JSON.stringify(data)});
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('jmaSubscribe').addEventListener('click', async () => {try {await registerPush();} catch(e) {set('登録失敗: '+e.message);}});
    $('jmaRefresh').addEventListener('click', refresh);
    $('jmaRunTest').addEventListener('click', async () => {
      try {
        const result = await adminPost('./api/jma/test', {fixture:$('jmaFixture').value});
        set(JSON.stringify({対象地域:result.bulletin.target, 情報種別:result.bulletin.info_type, 判定:result.decision, 理由:result.reason, 重複:result.duplicate, Push送信成功:result.push.sent, Push送信失敗:result.push.failed},null,2));
        await refresh();
      } catch(e) {set('テスト失敗: '+e.message);}
    });
    $('jmaOfficialNext').addEventListener('click', async () => {
      try {
        const r = await adminPost('./api/jma/official-replay/next', {});
        $('jmaOfficialResult').textContent = r.done ? r.message : JSON.stringify({
          再生件数: `${r.index}/${r.total}`, ファイル:r.file, 発表日時:r.report_time,
          鎌倉市の状態:r.name, 判定:r.transition,
          テストPush送信成功:r.push.sent, 失敗:r.push.failed
        }, null, 2);
      } catch(e) { $('jmaOfficialResult').textContent = '検証失敗: ' + e.message; }
    });
    $('jmaOfficialReset').addEventListener('click', async () => {
      try {
        await adminPost('./api/jma/official-replay/reset', {});
        $('jmaOfficialResult').textContent = '初期化しました。1件目から再生できます。';
      } catch(e) { $('jmaOfficialResult').textContent = '初期化失敗: ' + e.message; }
    });
    $('jmaResetTest').addEventListener('click', async () => {try {await adminPost('./api/jma/test/reset', {}); set('テストの重複判定履歴を初期化しました。'); await refresh();} catch(e) {set('初期化失敗: '+e.message);}});
    refresh();
  });
})();
