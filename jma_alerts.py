"""JMA Atom + XML parsing; test fixtures use the same parser as production."""
import datetime as dt
import urllib.request
import xml.etree.ElementTree as ET

FEEDS = ('https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
         'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml')
ATOM = '{http://www.w3.org/2005/Atom}'
JMX = '{http://xml.kishou.go.jp/jmaxml1/}'
KAMAKURA_CODE = '1420400'


def fetch(url):
    if not url.startswith('https://www.data.jma.go.jp/developer/xml/'):  # no arbitrary URL fetching
        raise ValueError('unsupported JMA URL')
    req = urllib.request.Request(url, headers={'User-Agent': 'KamakuraBosaiResearch/1.0 (educational prototype)'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read(4_000_000)


def parse_feed(xml_bytes):
    root = ET.fromstring(xml_bytes)
    entries = []
    for item in root.findall(f'{ATOM}entry'):
        link = next((e.get('href') for e in item.findall(f'{ATOM}link') if e.get('href', '').startswith('https://www.data.jma.go.jp/developer/xml/')), None)
        if not link:
            continue
        entries.append({'url': link, 'id': item.findtext(f'{ATOM}id') or link,
                        'updated': item.findtext(f'{ATOM}updated') or '',
                        'title': item.findtext(f'{ATOM}title') or ''})
    return entries


def parse_bulletin(xml_bytes):
    root = ET.fromstring(xml_bytes)
    title = root.findtext('.//{*}Head/{*}Title') or root.findtext('.//{*}Control/{*}Title') or '気象庁防災情報'
    event_id = root.findtext('.//{*}Head/{*}EventID') or ''
    report_time = root.findtext('.//{*}Head/{*}ReportDateTime') or ''
    serial = root.findtext('.//{*}Head/{*}Serial') or ''
    info_type = root.findtext('.//{*}Head/{*}InfoType') or ''
    # Only match explicit Kamakura Area elements, never free-text mentions.
    matched = []
    for area in root.findall('.//{*}Area'):
        name = area.findtext('./{*}Name') or ''
        code = area.findtext('./{*}Code') or ''
        if code == KAMAKURA_CODE or name == '鎌倉市':
            matched.append(name or '鎌倉市')
    return {'title': title, 'event_id': event_id, 'report_time': report_time,
            'serial': serial, 'info_type': info_type, 'matched': bool(matched),
            'target': '鎌倉市' if matched else '対象外'}


def get_current_bulletins(known_ids=None, max_entries=20):
    """Fetch only detail XMLs whose Atom entry ID+updated was not seen before."""
    known_ids = set(known_ids or [])
    seen = set()
    output = []
    all_ids = []
    for feed in FEEDS:
        for entry in parse_feed(fetch(feed))[:max_entries]:
            identity = entry['id'] + '|' + entry['updated']
            if identity in seen:
                continue
            seen.add(identity)
            all_ids.append(identity)
            if identity in known_ids:
                continue
            bulletin = parse_bulletin(fetch(entry['url']))
            bulletin['source_url'] = entry['url']
            bulletin['identity'] = identity
            output.append(bulletin)
    return output, all_ids
