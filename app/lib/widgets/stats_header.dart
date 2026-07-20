import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../models/api_models.dart';
import '../theme/radar_theme.dart';

/// Compact, low-noise stats line for the hero: a few localized facts joined by
/// dot separators, numbers in mono. Deliberately not a row of bordered pills —
/// it reads as one scannable status line, not "chip soup".
class StatsStrip extends StatelessWidget {
  const StatsStrip({super.key, required this.stats, this.monitor});

  final ProviderStats stats;
  final Map<String, dynamic>? monitor;

  String _num(double? v) => v == null ? '—' : v.toStringAsFixed(v < 10 ? 1 : 0);

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final facts = <String>[
      l.statConfirms(stats.totalConfirmed),
      stats.avgIntervalDays == null ? l.statAvgNone : l.statAvg(_num(stats.avgIntervalDays)),
      stats.longestDroughtDays == null
          ? l.statDroughtNone
          : l.statDrought(_num(stats.longestDroughtDays)),
      if (stats.bankedCreditCount > 0) l.statBanked(stats.bankedCreditCount),
    ];

    final monoMuted = radarMono(Theme.of(context).textTheme.bodySmall)
        .copyWith(color: RadarColors.muted, height: 1.4);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 4,
          children: [
            for (var i = 0; i < facts.length; i++) ...[
              Text(facts[i], style: monoMuted),
              if (i < facts.length - 1)
                Text('·', style: monoMuted.copyWith(color: RadarColors.border)),
            ],
          ],
        ),
        if (monitor != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                (monitor!['auto_publish'] == true || monitor!['mode'] == 'free_auto')
                    ? Icons.sensors_rounded
                    : Icons.sensors_off_rounded,
                size: 14,
                color: RadarColors.muted,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  l.autoMonitoring,
                  style: Theme.of(context).textTheme.labelSmall,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
