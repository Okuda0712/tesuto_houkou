"""Local JMA monitoring and opt-in Web Push server. Educational prototype."""
import json
import os
import secrets
import threading
import time
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from jma_alerts import get_current_bulletins, parse_bulletin
from jma_state_machine import evaluate
from validate_official_xml import read_city
from pywebpush import webpush, WebPushException
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import base64
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'jma_state.json'
SUBS = ROOT / 'push_subscriptions.json'
KEY = ROOT / 'vapid_private.pem'
ADMIN_FILE = ROOT / 'admin_token.txt'
POLL = max(60, int(os.getenv('JMA_POLL_SECONDS', '60')))
app = Flask(__name__, static_folder=None)
lock = threading.RLock()


def load(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def save(path, obj):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)


def token():
    if not ADMIN_FILE.exists():
        ADMIN_FILE.write_text(secrets.token_urlsafe(32), encoding='utf-8')
    return ADMIN_FILE.read_text(encoding='utf-8').strip()


def authorized():
    return secrets.compare_digest(request.headers.get('X-Admin-Token', ''), token())


def vapid_key():
    if KEY.exists():
        return serialization.load_pem_private_key(KEY.read_bytes(), password=None)
    key = ec.generate_private_key(ec.SECP256R1())
    KEY.write_bytes(key.private_bytes(Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    return key


def public_key():
    raw = vapid_key().public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def send_push(message, test_only):
    subscriptions = load(SUBS, [])
    success, failed, expired = 0, 0, []
    for record in subscriptions:
        if test_only and not record.get('test', False):
            continue
        try:
            webpush(subscription_info=record['subscription'], data=json.dumps(message, ensure_ascii=False),
                    vapid_private_key=str(KEY), vapid_claims={'sub': 'mailto:research@example.org'}, ttl=120)
            success += 1
        except WebPushException as e:
            failed += 1
            if getattr(getattr(e, 'response', None), 'status_code', None) in (404, 410):
                expired.append(record['subscription']['endpoint'])
        except Exception:
            failed += 1
    if expired:
        save(SUBS, [r for r in subscriptions if r['subscription']['endpoint'] not in expired])
    return {'sent': success, 'failed': failed}


def test_payload(b, kind):
    return {'title': '【訓練・テスト】鎌倉市 警報' + kind,
            'body': 'これは架空の訓練データです。実際の警報ではありません。',
            'url': './?screen=notifications',
            'tag': 'jma-drill-' + b['event_id'] + '-' + kind}


def process_fixture(name, state):
    allowed = {'kamakura_warning.xml', 'other_city.xml', 'kamakura_update.xml',
               'kamakura_cancel.xml', 'kamakura_old.xml', 'kamakura_invalid.xml'}
    if name not in allowed:
        raise ValueError('unknown fixture')
    try:
        bulletin = parse_bulletin((ROOT / 'test_fixtures' / name).read_bytes())
    except (OSError, ValueError, ET.ParseError) as e:
        result = {'fixture': name, 'bulletin': {'target': '不明', 'info_type': '不明'},
                  'decision': 'skip', 'reason': 'XML解析失敗', 'duplicate': False,
                  'push': {'sent': 0, 'failed': 0}}
        state['last_test'] = result
        return result
    states = state.setdefault('test_alert_states', {})
    decision, reason, updated = evaluate(bulletin, states)
    result = {'fixture': name, 'bulletin': bulletin, 'decision': decision,
              'reason': reason, 'duplicate': reason == '重複または古い電文',
              'push': {'sent': 0, 'failed': 0}}
    if decision == 'notify':
        state['test_alert_states'] = updated
        result['push'] = send_push(test_payload(bulletin, reason), test_only=True)
    state['last_test'] = result
    return result



OFFICIAL_SAMPLES = sorted((ROOT / 'official_sample_xml').glob('*.xml'))
LEVELS = {'00': 0, '10': 1, '03': 2, '43': 3, '33': 4}

def process_official_sample(state):
    """One staged official sample, isolated from real alerts and legacy fixture state."""
    progress = state.setdefault('official_replay', {'index': 0, 'last_code': None, 'last_time': None})
    idx = progress['index']
    if idx >= len(OFFICIAL_SAMPLES):
        return {'done': True, 'message': '8件の再生が完了しました。初期化して再実行できます。',
                'push': {'sent': 0, 'failed': 0}, 'index': idx}
    sample = OFFICIAL_SAMPLES[idx]
    when, code, name = read_city(sample.read_bytes())
    if code not in LEVELS:
        raise ValueError('未知の警報コード: ' + code)
    prev = progress['last_code']
    if prev is None:
        transition = '初回状態取得'
    elif code == prev:
        transition = '変化なし'
    elif code == '00':
        transition = '解除'
    elif LEVELS[code] > LEVELS[prev]:
        transition = '危険度上昇'
    else:
        transition = '危険度低下'
    # Explicit training prefix prevents confusion with actual disaster information.
    payload = {
        'title': f'【訓練・テスト】鎌倉市 {transition}',
        'body': f'公式サンプルXMLの再生です。実際の警報ではありません。状態: {name or code}',
        'url': './?screen=notifications',
        'tag': f'jma-official-drill-{idx}',
    }
    result = {'done': False, 'index': idx + 1, 'total': len(OFFICIAL_SAMPLES),
              'file': sample.name, 'report_time': when, 'code': code,
              'name': name, 'transition': transition, 'push': {'sent': 0, 'failed': 0}}
    # Never send a push for unchanged state; first baseline is a demonstration only.
    if transition != '変化なし':
        result['push'] = send_push(payload, test_only=True)
    progress.update({'index': idx + 1, 'last_code': code, 'last_time': when})
    state['last_official_replay'] = result
    return result

@app.post('/api/jma/official-replay/next')
def official_replay_next():
    if not authorized():
        return jsonify({'error': '管理者トークンが必要です'}), 403
    with lock:
        state = load(STATE, {})
        try:
            result = process_official_sample(state)
        except (ValueError, OSError, ET.ParseError) as e:
            return jsonify({'error': 'XML検証失敗: ' + str(e)}), 400
        save(STATE, state)
    return jsonify(result)

@app.post('/api/jma/official-replay/reset')
def official_replay_reset():
    if not authorized():
        return jsonify({'error': '管理者トークンが必要です'}), 403
    with lock:
        state = load(STATE, {})
        state.pop('official_replay', None)
        state.pop('last_official_replay', None)
        save(STATE, state)
    return jsonify({'ok': True})

def poll_once():
    with lock:
        state = load(STATE, {'real_seen': [], 'test_seen': []})
        bulletins, ids = get_current_bulletins(state.get('real_seen', []))
        if not state.get('real_initialized'):
            state['real_seen'] = ids
            state['real_initialized'] = True
            state['last_real'] = {'status': '初回基準登録', 'count': len(ids), 'sent': 0}
        else:
            old = set(state.get('real_seen', []))
            fresh = [b for b in bulletins if b['identity'] not in old and b['matched']]
            sent = 0
            for b in (fresh if os.getenv('JMA_ENABLE_UNVERIFIED_REAL_PUSH') == '1' else []):
                payload = {'title': '【気象庁】' + b['title'], 'body': '鎌倉市が対象に含まれる情報です。公式情報を確認してください。',
                           'url': b['source_url'], 'tag': 'jma-' + (b['event_id'] or b['identity'])}
                sent += send_push(payload, test_only=False)['sent']
            state['real_seen'] = list(dict.fromkeys(ids + state.get('real_seen', [])))[:500]
            state['last_real'] = {'status': '取得成功', 'count': len(ids), 'new_matching': len(fresh), 'sent': sent, 'real_push_enabled': os.getenv('JMA_ENABLE_UNVERIFIED_REAL_PUSH') == '1'}
        state['last_real']['checked_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
        save(STATE, state)
        return state['last_real']


def worker():
    while True:
        try:
            print('[JMA]', poll_once(), flush=True)
        except Exception as e:
            with lock:
                state = load(STATE, {'real_seen': [], 'test_seen': []})
                state['last_real'] = {'status': '取得失敗', 'error': str(e), 'checked_at': time.strftime('%Y-%m-%d %H:%M:%S')}
                save(STATE, state)
            print('[JMA ERROR]', e, flush=True)
        time.sleep(POLL)


@app.get('/api/jma/status')
def status():
    state = load(STATE, {})
    return jsonify({'poll_seconds': POLL, 'real': state.get('last_real', {'status': '未取得'}),
                    'test': state.get('last_test'), 'test_mode': 'fixture replay (admin only)'})


@app.get('/api/push/public-key')
def key_endpoint():
    return jsonify({'publicKey': public_key()})


@app.post('/api/push/subscribe')
def subscribe():
    data = request.get_json(silent=True) or {}
    sub = data.get('subscription') or {}
    endpoint = sub.get('endpoint', '')
    keys = sub.get('keys') or {}
    if not endpoint.startswith('https://') or not all(keys.get(k) for k in ('p256dh', 'auth')):
        return jsonify({'error': 'invalid subscription'}), 400
    with lock:
        records = load(SUBS, [])
        records = [r for r in records if r['subscription']['endpoint'] != endpoint]
        records.append({'subscription': sub, 'test': bool(data.get('test', True))})
        save(SUBS, records)
    return jsonify({'ok': True})


@app.post('/api/jma/test')
def run_fixture():
    if not authorized():
        return jsonify({'error': '管理者トークンが必要です'}), 403
    data = request.get_json(silent=True) or {}
    with lock:
        state = load(STATE, {'real_seen': [], 'test_seen': []})
        state.setdefault('test_seen', [])
        try:
            result = process_fixture(data.get('fixture', ''), state)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        save(STATE, state)
    return jsonify(result)


@app.post('/api/jma/test/reset')
def reset_fixture():
    if not authorized():
        return jsonify({'error': '管理者トークンが必要です'}), 403
    with lock:
        state = load(STATE, {'real_seen': [], 'test_seen': []})
        state['test_seen'] = []
        state['test_alert_states'] = {}
        save(STATE, state)
    return jsonify({'ok': True})


@app.get('/')
def home():
    return send_from_directory(ROOT, 'index.html')


@app.get('/<path:filename>')
def static(filename):
    if filename.startswith(('api/', 'test_fixtures/', 'official_sample_xml/')) or filename in ('server.py', 'jma_alerts.py', 'vapid_private.pem', 'admin_token.txt', 'jma_state.json', 'push_subscriptions.json') or filename.startswith('.'):
        return 'Not found', 404
    return send_from_directory(ROOT, filename)


if __name__ == '__main__':
    token()
    vapid_key()
    print('Admin token: admin_token.txt (keep private)')
    threading.Thread(target=worker, daemon=True).start()
    app.run(host='127.0.0.1', port=8039, debug=False, use_reloader=False)
