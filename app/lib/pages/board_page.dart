import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../models/api_models.dart';
import '../services/radar_api.dart';
import '../theme/radar_theme.dart';
import '../widgets/provider_status_card.dart';
import '../widgets/status_visual.dart';
import '../widgets/verdict_hero.dart';

class BoardPage extends StatefulWidget {
  const BoardPage({super.key, required this.api});

  final RadarApi api;

  @override
  State<BoardPage> createState() => BoardPageState();
}

class BoardPageState extends State<BoardPage> {
  SnapshotResponse? snapshot;
  StatsResponse? stats;
  Map<String, dynamic>? monitor;
  List<double> intervals = const [];
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await widget.api.fetchSnapshot();
      StatsResponse? st;
      Map<String, dynamic>? mon;
      List<double> iv = const [];
      try {
        st = await widget.api.fetchStats();
      } catch (_) {}
      try {
        mon = await widget.api.fetchMonitor();
      } catch (_) {}
      try {
        final events = await widget.api.fetchEvents(limit: 60);
        iv = _intervalsFromEvents(events.items);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        snapshot = data;
        stats = st;
        monitor = mon;
        intervals = iv;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  /// Days between consecutive confirmed hard resets (oldest → newest, last 10).
  List<double> _intervalsFromEvents(List<EventData> events) {
    final times = events
        .where((e) => e.type == 'hard_reset' && !e.retracted)
        .map((e) => DateTime.tryParse(e.announcedAt))
        .whereType<DateTime>()
        .toList()
      ..sort();
    final out = <double>[];
    for (var i = 1; i < times.length; i++) {
      final d = times[i].difference(times[i - 1]).inHours / 24.0;
      if (d > 0) out.add(d);
    }
    return out.length > 10 ? out.sublist(out.length - 10) : out;
  }

  ProviderStats? get _codexStats =>
      stats?.providers.where((p) => p.provider == 'codex').firstOrNull ??
      stats?.overall;

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final cols = RadarBreakpoints.gridColumns(w);
        final pad = RadarBreakpoints.pagePadding(w);
        final providers = snapshot?.providers ?? [];
        final monitored = providers.where((p) => p.monitored).toList();
        final others = providers.where((p) => !p.monitored).toList();

        return RefreshIndicator(
          color: RadarColors.accent,
          onRefresh: refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: EdgeInsets.fromLTRB(pad, pad, pad, 4),
                sliver: SliverToBoxAdapter(
                  child: VerdictHero(
                    snapshot: snapshot,
                    codexStats: _codexStats,
                    monitor: monitor,
                    intervals: intervals,
                  ),
                ),
              ),
              if (loading && snapshot == null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _BoardSkeleton(columns: cols, pad: pad),
                )
              else if (error != null && snapshot == null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: EdgeInsets.all(pad),
                    child: _ErrorPanel(message: error!, onRetry: refresh),
                  ),
                )
              else ...[
                if (error != null)
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: pad),
                    sliver: SliverToBoxAdapter(
                      child: _ErrorPanel(
                        message: error!,
                        onRetry: refresh,
                        compact: true,
                      ),
                    ),
                  ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(pad, 20, pad, 8),
                  sliver: SliverToBoxAdapter(
                    child: _SectionHeader(
                      title: l.watchedProviders,
                      trailing: '${monitored.length}',
                    ),
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: pad),
                  sliver: SliverToBoxAdapter(
                    child: _CardGrid(items: monitored, cols: cols),
                  ),
                ),
                if (others.isNotEmpty) ...[
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(pad, 28, pad, 8),
                    sliver: SliverToBoxAdapter(
                      child: _SectionHeader(
                        title: l.notCovered,
                        subtitle: l.notCoveredHint,
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: pad),
                    sliver: SliverToBoxAdapter(
                      child: _CardGrid(items: others, cols: cols, compact: true),
                    ),
                  ),
                ],
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(pad, 28, pad, 8),
                  sliver: const SliverToBoxAdapter(child: _Legend()),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(pad, 8, pad, 40),
                  sliver: SliverToBoxAdapter(
                    child: Text(
                      l.footerDisclaimer,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: RadarColors.muted,
                            height: 1.5,
                          ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Equal-height card rows — sizes to content per row, so cards never clip.
class _CardGrid extends StatelessWidget {
  const _CardGrid({required this.items, required this.cols, this.compact = false});

  final List<ProviderCardData> items;
  final int cols;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    const spacing = 16.0;
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += cols) {
      final rowItems = items.sublist(i, (i + cols).clamp(0, items.length));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < cols; j++) ...[
                if (j > 0) const SizedBox(width: spacing),
                Expanded(
                  child: j < rowItems.length
                      ? ProviderStatusCard(data: rowItems[j], compact: compact)
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
      if (i + cols < items.length) rows.add(const SizedBox(height: spacing));
    }
    return Column(children: rows);
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing, this.subtitle});

  final String title;
  final String? trailing;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            if (trailing != null) ...[
              const SizedBox(width: 8),
              Text(
                trailing!,
                style: radarMono(Theme.of(context).textTheme.labelLarge)
                    .copyWith(color: RadarColors.muted),
              ),
            ],
          ],
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
        ],
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  static const _keys = [
    'active_confirmed',
    'detected_pending',
    'no_recent_confirmed',
    'source_unhealthy',
    'not_monitored',
  ];

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: RadarColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: RadarColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.legendTitle, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          Text(
            l.legendBody,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [for (final key in _keys) StatusPill(status: key)],
          ),
        ],
      ),
    );
  }
}

class _BoardSkeleton extends StatelessWidget {
  const _BoardSkeleton({required this.columns, required this.pad});

  final int columns;
  final double pad;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(pad, 20, pad, pad),
      child: Column(
        children: [
          for (var row = 0; row < 2; row++) ...[
            Row(
              children: [
                for (var c = 0; c < columns; c++) ...[
                  if (c > 0) const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      height: 180,
                      decoration: BoxDecoration(
                        color: RadarColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: RadarColors.border),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            if (row == 0) const SizedBox(height: 16),
          ],
          const SizedBox(height: 24),
          Text(
            AppL10n.of(context).loadingSnapshot,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({
    required this.message,
    required this.onRetry,
    this.compact = false,
  });

  final String message;
  final VoidCallback onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(bottom: compact ? 12 : 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: RadarColors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: RadarColors.danger.withValues(alpha: 0.4)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: RadarColors.danger),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  l.errorTitle,
                  style: const TextStyle(
                    color: RadarColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(l.retry),
          ),
        ],
      ),
    );
  }
}
