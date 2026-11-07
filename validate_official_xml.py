"""Offline, read-only validation of JMA's 8 staged sample XMLs. NO PUSH."""
from pathlib import Path
from datetime import datetime
import xml.etree.ElementTree as ET
from jma_alerts import parse_bulletin
from jma_state_machine import evaluate

HERE = Path(__file__).resolve().parent
SAMPLES = HERE / 'official_sample_xml'
CODE = '1420400'
EXPECTED = ['10','03','43','33','43','03','10','00']

def read_city(xml_bytes):
    root = ET.fromstring(xml_bytes)
    time = root.findtext('.//{*}Head/{*}ReportDateTime')
    if not time:
        raise ValueError('発表日時なし')
    datetime.fromisoformat(time.replace('Z', '+00:00'))
    groups = [i for i in root.findall('.//{*}Information') if i.attrib.get('type') == '気象警報・注意報（市町村等）']
    if not groups:
        raise ValueError('市町村別情報なし')
    found = []
    for group in groups:
        for item in group.findall('./{*}Item'):
            if any(a.findtext('./{*}Code') == CODE for a in item.findall('./{*}Areas/{*}Area')):
                for kind in item.findall('./{*}Kind'):
                    found.append((kind.findtext('./{*}Code'),kind.findtext('./{*}Name')))
    if len(found) != 1 or not found[0][0]:
        raise ValueError('鎌倉市の状態が一意に確定しない: '+str(found))
    return time, found[0][0], found[0][1]

def run():
    files = sorted(SAMPLES.glob('*.xml'))
    if len(files) != 8:
        raise ValueError('8ファイル必要: '+str(len(files)))
    legacy_state = {}
    previous = None
    seen = set()
    outcomes = []
    print('ファイル | 鎌倉市状態 | 既存判定 | 状態差分判定')
    for idx, file in enumerate(files):
        data = file.read_bytes()
        bulletin = parse_bulletin(data)
        old_decision, old_reason, legacy_state = evaluate(bulletin, legacy_state)
        time, code, name = read_city(data)
        if code != EXPECTED[idx]:
            raise AssertionError((idx, code, EXPECTED[idx]))
        fingerprint = (time, code)
        if fingerprint in seen:
            decision = '重複'
        elif previous is None:
            decision = '初回状態取得'
        elif code == previous:
            decision = '変化なし'
        elif code == '00':
            decision = '解除'
        elif previous == '00':
            decision = '新規発表'
        else:
            decision = '状態変更'
        seen.add(fingerprint)
        previous = code
        outcomes.append((old_decision,decision))
        print(f'{file.name} | {name}({code}) | {old_decision}：{old_reason} | {decision}')
    assert all(old == 'skip' for old,_ in outcomes), '既存ロジックの想定外結果'
    assert [d for _,d in outcomes] == ['初回状態取得','状態変更','状態変更','状態変更','状態変更','状態変更','状態変更','解除']
    print('\n検証完了: 8/8 XML解析・鎌倉市状態抽出・状態遷移の期待値一致')
    print('既存の訓練用判定: 8/8 通知スキップ（EventIDとSerialが空欄）')
    print('注意: このスクリプトは検証専用で、実運用の警報通知には接続していません。')

if __name__ == '__main__':
    run()
