import 'package:flutter_test/flutter_test.dart';
import 'package:reset_radar/models/api_models.dart';

void main() {
  test('parses next_48h insufficient_data', () {
    final j = {
      'provider': 'claude',
      'display_name': 'Claude',
      'monitored': true,
      'display_status': 'no_recent_confirmed',
      'source_health': 'fresh',
      'as_of': '2026-07-20T00:00:00.000Z',
      'active_event': null,
      'last_confirmed_event': null,
      'pending_detection': null,
      'next_48h': {
        'window_hours': 48,
        'probability': null,
        'band': 'insufficient_data',
        'factors': [],
        'calculated_at': '2026-07-20T00:00:00.000Z',
        'method': 'deterministic_v1',
        'disclaimer': '啟發式估計，非官方、非確認。',
      },
    };
    final c = ProviderCardData.fromJson(j);
    expect(c.next48h?.band, 'insufficient_data');
    expect(c.next48h?.probability, isNull);
    expect(c.next48h?.bandLabelZh, '資料不足');
  });

  test('parses next_48h low band with factors', () {
    final j = {
      'provider': 'codex',
      'display_name': 'Codex',
      'monitored': true,
      'display_status': 'no_recent_confirmed',
      'source_health': 'fresh',
      'as_of': '2026-07-20T00:00:00.000Z',
      'active_event': null,
      'last_confirmed_event': null,
      'pending_detection': null,
      'next_48h': {
        'window_hours': 48,
        'probability': 12,
        'band': 'low',
        'factors': [
          {'id': 'baseline', 'label': '歷史基線', 'delta': 12},
          {'id': 'cooldown', 'label': '重置後冷卻', 'delta': -25},
        ],
        'calculated_at': '2026-07-20T00:00:00.000Z',
        'method': 'deterministic_v1',
        'disclaimer': '啟發式估計，非官方、非確認。綠燈只代表已確認公開 hard reset。',
      },
    };
    final c = ProviderCardData.fromJson(j);
    expect(c.next48h?.probability, 12);
    expect(c.next48h?.bandLabelZh, '低');
    expect(c.next48h?.factors.length, 2);
    expect(c.next48h?.factors.first.label, '歷史基線');
  });

  test('parses renewal_survival_v2 fields (lo/hi/sample/complement)', () {
    final j = {
      'provider': 'codex',
      'display_name': 'Codex',
      'monitored': true,
      'display_status': 'no_recent_confirmed',
      'source_health': 'fresh',
      'as_of': '2026-07-21T00:00:00.000Z',
      'active_event': null,
      'last_confirmed_event': null,
      'pending_detection': null,
      'next_48h': {
        'window_hours': 48,
        'probability': 40,
        'probability_lo': 20,
        'probability_hi': 60,
        'sample_size': 11,
        'band': 'medium',
        'factors': [
          {'id': 'renewal_k', 'label': '叢集型（k=0.68<1）', 'delta': 0},
        ],
        'calculated_at': '2026-07-21T00:00:00.000Z',
        'method': 'renewal_survival_v2',
        'disclaimer': '啟發式估計，非官方、非確認。',
      },
    };
    final c = ProviderCardData.fromJson(j);
    final f = c.next48h!;
    expect(f.method, 'renewal_survival_v2');
    expect(f.probability, 40);
    expect(f.probabilityLo, 20);
    expect(f.probabilityHi, 60);
    expect(f.sampleSize, 11);
    expect(f.notProbability, 60);
  });
}
