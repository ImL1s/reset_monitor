import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../theme/radar_theme.dart';

class StatsHeader extends StatelessWidget {
  const StatsHeader({super.key, required this.stats, this.monitor});

  final ProviderStats stats;
  final Map<String, dynamic>? monitor;

  String _autoLine() {
    if (monitor == null) return '';
    final auto = monitor!['auto_publish'] == true;
    final source = monitor!['source']?.toString() ?? '—';
    final mode = monitor!['mode']?.toString() ?? '';
    final on = mode == 'free_auto' || auto;
    return 'Auto monitoring: ${on ? "ON" : "OFF"} · every ~10 min · '
        'rules first, optional LLM · auto-publish: ${auto ? "ON" : "OFF"} · '
        'source $source';
  }

  @override
  Widget build(BuildContext context) {
    final chips = <(IconData, String, Color)>[
      (
        Icons.bolt_rounded,
        '${stats.totalConfirmed} resets tracked',
        RadarColors.accent,
      ),
      (
        Icons.hourglass_bottom_rounded,
        stats.daysSinceLast == null
            ? 'no last reset'
            : '${stats.daysSinceLast}d since last',
        RadarColors.warning,
      ),
      (
        Icons.timeline_rounded,
        stats.avgIntervalDays == null
            ? 'avg —'
            : 'avg ${stats.avgIntervalDays}d',
        RadarColors.info,
      ),
      (
        Icons.water_drop_outlined,
        stats.longestDroughtDays == null
            ? 'drought —'
            : 'drought ${stats.longestDroughtDays}d',
        RadarColors.muted,
      ),
      (
        Icons.savings_outlined,
        '${stats.bankedCreditCount} banked',
        RadarColors.info,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final c in chips)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: RadarColors.bg.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: RadarColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(c.$1, size: 16, color: c.$3),
                    const SizedBox(width: 8),
                    Text(
                      c.$2,
                      style: TextStyle(
                        color: c.$3,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        if (monitor != null) ...[
          const SizedBox(height: 12),
          Text(
            _autoLine(),
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ],
      ],
    );
  }
}
