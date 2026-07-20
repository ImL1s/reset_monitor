import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../models/api_models.dart';
import '../theme/radar_theme.dart';
import 'relative_time.dart';
import 'sparkline.dart';
import 'stats_header.dart';

/// The single dominant answer on the board: "is there a public RESET right
/// now?" — with source health promoted to a first-class badge, the last public
/// reset as a giant mono number, and a cadence sparkline. Everything else on
/// the board is secondary to this block.
class VerdictHero extends StatelessWidget {
  const VerdictHero({
    super.key,
    required this.snapshot,
    required this.codexStats,
    required this.monitor,
    required this.intervals,
  });

  final SnapshotResponse? snapshot;
  final ProviderStats? codexStats;
  final Map<String, dynamic>? monitor;

  /// Days between consecutive confirmed hard resets, oldest → newest.
  final List<double> intervals;

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final providers = snapshot?.providers ?? const <ProviderCardData>[];
    final live = providers
        .where((p) =>
            p.displayStatus == 'active_confirmed' ||
            p.displayStatus == 'active_confirmed_degraded')
        .toList();
    final hasNow = live.isNotEmpty;
    final pending =
        providers.where((p) => p.displayStatus == 'detected_pending').length;
    final monitored = providers.where((p) => p.monitored).toList();
    final health = _healthState(monitored);

    final verdictColor = hasNow ? RadarColors.accent : RadarColors.muted;

    return LayoutBuilder(
      builder: (context, c) {
        final wide = c.maxWidth >= 720;
        final pad = c.maxWidth < 480 ? 18.0 : 24.0;

        final verdict = _VerdictColumn(
          l: l,
          hasNow: hasNow,
          liveCount: live.length,
          liveNames: live.map((p) => p.displayName).toList(),
          color: verdictColor,
        );
        final metrics = _MetricsColumn(
          l: l,
          codexStats: codexStats,
          monitor: monitor,
          intervals: intervals,
        );

        return Container(
          padding: EdgeInsets.all(pad),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: hasNow
                  ? RadarColors.accent.withValues(alpha: 0.40)
                  : RadarColors.border,
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                RadarColors.surfaceHi,
                verdictColor.withValues(alpha: 0.06),
                RadarColors.bg,
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l.appTagline,
                style: Theme.of(context)
                    .textTheme
                    .labelMedium
                    ?.copyWith(color: RadarColors.muted),
              ),
              const SizedBox(height: 12),
              _MetaLine(
                l: l,
                health: health,
                asOf: snapshot?.generatedAt ?? '',
                monitoredCount: monitored.length,
                pending: pending,
              ),
              const SizedBox(height: 20),
              if (wide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 5, child: verdict),
                    const SizedBox(width: 28),
                    Expanded(flex: 4, child: metrics),
                  ],
                )
              else ...[
                verdict,
                const SizedBox(height: 24),
                const Divider(height: 1),
                const SizedBox(height: 20),
                metrics,
              ],
            ],
          ),
        );
      },
    );
  }

  _Health _healthState(List<ProviderCardData> monitored) {
    if (monitored.isEmpty) return _Health.unknown;
    if (monitored.any((p) => p.displayStatus == 'source_unhealthy')) {
      return _Health.stale;
    }
    final anyStale = monitored.any(
      (p) => p.sourceHealth.isNotEmpty && p.sourceHealth != 'fresh',
    );
    return anyStale ? _Health.stale : _Health.ok;
  }
}

enum _Health { ok, stale, unknown }

class _MetaLine extends StatelessWidget {
  const _MetaLine({
    required this.l,
    required this.health,
    required this.asOf,
    required this.monitoredCount,
    required this.pending,
  });

  final AppL10n l;
  final _Health health;
  final String asOf;
  final int monitoredCount;
  final int pending;

  @override
  Widget build(BuildContext context) {
    final (hColor, hLabel, hIcon) = switch (health) {
      _Health.ok => (RadarColors.accent, l.sourcesOk, Icons.verified_rounded),
      _Health.stale => (RadarColors.warning, l.sourcesStale, Icons.warning_amber_rounded),
      _Health.unknown => (RadarColors.muted, l.sourcesUnknown, Icons.help_outline_rounded),
    };
    return Wrap(
      spacing: 14,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _MetaItem(icon: hIcon, label: hLabel, color: hColor, strong: true),
        if (asOf.isNotEmpty)
          _MetaItem(
            icon: Icons.schedule_rounded,
            label: l.asOf(formatRadarTime(asOf)),
            color: RadarColors.muted,
            mono: true,
          ),
        _MetaItem(
          icon: Icons.sensors_rounded,
          label: l.monitoredCount(monitoredCount),
          color: RadarColors.muted,
        ),
        if (pending > 0)
          _MetaItem(
            icon: Icons.hourglass_top_rounded,
            label: l.weakSignals(pending),
            color: RadarColors.warning,
          ),
      ],
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({
    required this.icon,
    required this.label,
    required this.color,
    this.strong = false,
    this.mono = false,
  });

  final IconData icon;
  final String label;
  final Color color;
  final bool strong;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).textTheme.labelMedium;
    final style = (mono ? radarMono(base) : base)?.copyWith(
      color: color,
      fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 6),
        Text(label, style: style),
      ],
    );
  }
}

class _VerdictColumn extends StatelessWidget {
  const _VerdictColumn({
    required this.l,
    required this.hasNow,
    required this.liveCount,
    required this.liveNames,
    required this.color,
  });

  final AppL10n l;
  final bool hasNow;
  final int liveCount;
  final List<String> liveNames;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Dot(color: hasNow ? RadarColors.accent : RadarColors.muted),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                hasNow ? l.verdictLiveTitle : l.verdictCalmTitle,
                style: t.headlineMedium?.copyWith(
                  color: hasNow ? RadarColors.accentText : RadarColors.text,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          hasNow ? l.verdictLiveSub(liveCount) : l.verdictCalmSub,
          style: t.bodyMedium?.copyWith(color: RadarColors.muted),
        ),
        if (hasNow && liveNames.isNotEmpty) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [for (final name in liveNames) _LivePill(name: name)],
          ),
        ],
      ],
    );
  }
}

class _LivePill extends StatelessWidget {
  const _LivePill({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: RadarColors.accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: RadarColors.accent.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle_rounded,
              size: 15, color: RadarColors.accentText),
          const SizedBox(width: 6),
          Text(
            name,
            style: radarMono(Theme.of(context).textTheme.labelMedium).copyWith(
              color: RadarColors.accentText,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricsColumn extends StatelessWidget {
  const _MetricsColumn({
    required this.l,
    required this.codexStats,
    required this.monitor,
    required this.intervals,
  });

  final AppL10n l;
  final ProviderStats? codexStats;
  final Map<String, dynamic>? monitor;
  final List<double> intervals;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final days = codexStats?.daysSinceLast;
    final big = days == null ? l.lastResetNever : relativeDays(l, days);
    final hasCadence = intervals.isNotEmpty || days != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.lastResetLabel.toUpperCase(),
          style: t.labelSmall?.copyWith(
            color: RadarColors.muted,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          big,
          style: radarMono(t.headlineLarge).copyWith(
            color: RadarColors.text,
            fontWeight: FontWeight.w700,
            letterSpacing: -1,
          ),
        ),
        if (codexStats?.lastResetAt != null) ...[
          const SizedBox(height: 2),
          Text(
            formatRadarTime(codexStats!.lastResetAt!),
            style: radarMono(t.labelSmall).copyWith(color: RadarColors.muted),
          ),
        ],
        const SizedBox(height: 16),
        Text(
          l.recentCadence.toUpperCase(),
          style: t.labelSmall?.copyWith(
            color: RadarColors.muted,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        if (hasCadence)
          SparkBars(
            values: intervals,
            current: days,
            semanticLabel: l.recentCadence,
          )
        else
          Text(
            l.cadenceNoData,
            style: t.bodySmall?.copyWith(color: RadarColors.muted),
          ),
        if (codexStats != null) ...[
          const SizedBox(height: 16),
          StatsStrip(stats: codexStats!, monitor: monitor),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 10),
        ],
      ),
    );
  }
}
