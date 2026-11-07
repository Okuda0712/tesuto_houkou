"""Offline unit tests. No network, no push service, no real JMA feed."""
import unittest
from pathlib import Path
from unittest.mock import patch
from jma_alerts import parse_bulletin
from jma_state_machine import evaluate

FIX = Path(__file__).parent / 'test_fixtures'

def fixture(name):
    return parse_bulletin((FIX / name).read_bytes())

class AlertTests(unittest.TestCase):
    def test_lifecycle(self):
        state = {}
        for filename, reason in [('kamakura_warning.xml','発表'),('kamakura_update.xml','更新'),('kamakura_cancel.xml','解除')]:
            action, result, state = evaluate(fixture(filename), state)
            self.assertEqual((action,result), ('notify',reason))
        self.assertEqual(len(state), 1)

    def test_duplicate(self):
        _, _, state = evaluate(fixture('kamakura_warning.xml'), {})
        action, reason, _ = evaluate(fixture('kamakura_warning.xml'), state)
        self.assertEqual(action,'skip')

    def test_other_city(self):
        action, reason, state = evaluate(fixture('other_city.xml'), {})
        self.assertEqual(action,'skip')
        self.assertEqual(state,{})

    def test_out_of_order(self):
        _, _, state = evaluate(fixture('kamakura_warning.xml'), {})
        _, _, state = evaluate(fixture('kamakura_update.xml'), state)
        action, _, _ = evaluate(fixture('kamakura_old.xml'), state)
        self.assertEqual(action,'skip')

    def test_no_unverified_cancellation(self):
        action, _, state = evaluate(fixture('kamakura_cancel.xml'), {})
        self.assertEqual(action,'skip')
        self.assertEqual(state,{})

    def test_after_cancellation(self):
        state = {}
        for name in ('kamakura_warning.xml','kamakura_update.xml','kamakura_cancel.xml'):
            _, _, state = evaluate(fixture(name), state)
        action, _, _ = evaluate(fixture('kamakura_warning.xml'), state)
        self.assertEqual(action,'skip')

    def test_missing_fields(self):
        bulletin = fixture('kamakura_warning.xml')
        bulletin['info_type'] = '不明'
        action, _, _ = evaluate(bulletin, {})
        self.assertEqual(action,'skip')

    def test_invalid_xml(self):
        from xml.etree.ElementTree import ParseError
        with self.assertRaises(ParseError):
            fixture('kamakura_invalid.xml')

    def test_server_fixture_no_real_push(self):
        try:
            import server
        except ImportError:
            self.skipTest('Flask / pywebpush not installed')
        with patch.object(server, 'send_push', return_value={'sent':1,'failed':0}) as mock:
            state = {'test_alert_states':{}}
            for name in ('kamakura_warning.xml','kamakura_update.xml','kamakura_cancel.xml'):
                self.assertEqual(server.process_fixture(name,state)['decision'],'notify')
            self.assertEqual(server.process_fixture('kamakura_warning.xml',state)['decision'],'skip')
            self.assertEqual(server.process_fixture('other_city.xml',state)['decision'],'skip')
            self.assertEqual(server.process_fixture('kamakura_invalid.xml',state)['decision'],'skip')
            self.assertEqual(mock.call_count,3)
            self.assertTrue(all(c.kwargs.get('test_only') is True for c in mock.call_args_list))

if __name__ == '__main__':
    unittest.main(verbosity=2)
