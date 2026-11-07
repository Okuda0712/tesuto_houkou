"""Conservative alert transition engine. Synthetic training bulletins only until validated."""
from datetime import datetime

VALID = {'発表', '更新', '解除'}


def timestamp(value):
    if not value:
        raise ValueError('発表日時がありません')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def evaluate(b, state):
    """Return (decision, reason, next_state). Never mutate original state."""
    current = dict(state)
    if not b.get('matched'):
        return 'skip', '対象地域外', current
    event = b.get('event_id')
    kind = b.get('info_type')
    if not event or kind not in VALID or not b.get('report_time'):
        return 'skip', '識別子・日時・種別が不明（安全のため通知しない）', current
    try:
        when = timestamp(b['report_time'])
        serial = int(b['serial'])
    except (ValueError, TypeError, OverflowError):
        return 'skip', '日時または連番が不正', current
    if serial < 1:
        return 'skip', '連番が不正', current
    key = event + '|鎌倉市'
    previous = current.get(key)
    if previous:
        prev_time = timestamp(previous['report_time'])
        prev_serial = previous['serial']
        if when <= prev_time or serial <= prev_serial:
            return 'skip', '重複または古い電文', current
        if previous['status'] == '解除':
            return 'skip', '解除済み事象の再通知を防止', current
        if kind == '発表':
            return 'skip', '発表済み事象の再発表を防止', current
    elif kind != '発表':
        return 'skip', '発表を確認できない更新・解除', current
    current[key] = {'status': kind, 'report_time': b['report_time'], 'serial': serial}
    return 'notify', kind, current
