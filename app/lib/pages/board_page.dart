import 'package:flutter/material.dart';

import '../models/api_models.dart';
import '../services/radar_api.dart';
import '../theme/radar_theme.dart';
import '../widgets/provider_status_card.dart';
import '../widgets/stats_header.dart';
import '../widgets/status_visual.dart';

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
      try {
        st = await widget.api.fetchStats();
      } catch (_) {}
      try {
        mon = await widget.api.fetchMonitor();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        snapshot = data;
        stats = st;
        monitor = mon;
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

  @override
  Widget build(BuildContext context) {
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
                padding: EdgeInsets.fromLTRB(pad, pad, pad, 8),
                sliver: SliverToBoxAdapter(
                  child: _HeroHeader(
                    snapshot: snapshot,
                    stats: stats,
                    monitor: monitor,
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
                  padding: EdgeInsets.fromLTRB(pad, 4, pad, 8),
                  sliver: const SliverToBoxAdapter(child: _StatusLegend()),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(pad, 8, pad, 8),
                  sliver: SliverToBoxAdapter(
                    child: Row(
                      children: [
                        Text(
                          'Watched providers',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${monitored.length}',
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                color: RadarColors.muted,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: pad),
                  sliver: SliverGrid(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: cols,
                      mainAxisExtent: cols == 1 ? 380 : 400,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, i) => ProviderStatusCard(data: monitored[i]),
                      childCount: monitored.length,
                    ),
                  ),
                ),
                if (others.isNotEmpty) ...[
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(pad, 28, pad, 8),
                    sliver: SliverToBoxAdapter(
                      child: Text(
                        'Not covered (no public hard-reset feed)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(pad, 0, pad, 32),
                    sliver: SliverGrid(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cols,
                        mainAxisExtent: 220,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => ProviderStatusCard(
                          data: others[i],
                          compact: true,
                        ),
                        childCount: others.length,
                      ),
                    ),
                  ),
                ],
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(pad, 0, pad, 40),
                  sliver: const SliverToBoxAdapter(child: _FooterNote()),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HeroHeader extends StatelessWidget {
  const _HeroHeader({this.snapshot, this.stats, this.monitor});

  final SnapshotResponse? snapshot;
  final StatsResponse? stats;
  final Map<String, dynamic>? monitor;

  @override
  Widget build(BuildContext context) {
    final providers = snapshot?.providers ?? [];
    final confirmed = providers
        .where(
          (p) =>
              p.displayStatus == 'active_confirmed' ||
              p.displayStatus == 'active_confirmed_degraded',
        )
        .length;
    final pending = providers
        .where((p) => p.displayStatus == 'detected_pending')
        .length;
    final monitored = providers.where((p) => p.monitored).length;
    final hasNow = confirmed > 0;

    final codexStats = stats?.providers
            .where((p) => p.provider == 'codex')
            .firstOrNull ??
        stats?.overall;
    final days = codexStats?.daysSinceLast;
    final lastAgo = days == null
        ? '—'
        : days < 1
            ? '${(days * 24).round()}h ago'
            : '${days.toStringAsFixed(days < 10 ? 1 : 0)}d ago';

    final isWide = MediaQuery.sizeOf(context).width >= 600;
    final nowColor = hasNow ? RadarColors.accent : RadarColors.muted;

    return Container(
      padding: EdgeInsets.all(isWide ? 24 : 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: RadarColors.border),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            RadarColors.elevated,
            nowColor.withValues(alpha: 0.08),
            RadarColors.bg,
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Public RESET radar · not your personal quota',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
          const SizedBox(height: 14),
          Text(
            '1. 現在有沒有 RESET？',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            hasNow
                ? '有 — $confirmed 個來源仍在公開確認窗內'
                : '沒有 — 現在沒有進行中的公開 RESET',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: nowColor,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 16),
          Text(
            '2. 上次公開 RESET 是多久？',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            days == null ? '尚無已確認的公開 RESET' : '上次：$lastAgo',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: RadarColors.text,
                  fontWeight: FontWeight.w800,
                ),
          ),
          if (codexStats?.lastResetAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Codex last: ${formatRadarTime(codexStats!.lastResetAt!)}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: 8),
          Text(
            '「上次」是官方公開公告時間（像 codex-resets 的 2 days ago）。'
            '灰/「沒有」= 確認窗已過，不是壞掉。綠燈只在約 24 小時窗內。',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _StatChip(
                icon: hasNow
                    ? Icons.check_circle_rounded
                    : Icons.remove_circle_outline,
                label: hasNow ? '現在：有' : '現在：沒有',
                color: nowColor,
              ),
              _StatChip(
                icon: Icons.history_rounded,
                label: '上次：$lastAgo',
                color: RadarColors.info,
              ),
              if (pending > 0)
                _StatChip(
                  icon: Icons.hourglass_top_rounded,
                  label: '$pending 弱訊號（不算 RESET）',
                  color: RadarColors.warning,
                ),
              _StatChip(
                icon: Icons.sensors_rounded,
                label: '監控 $monitored 源',
                color: RadarColors.info,
              ),
              if (snapshot != null)
                _StatChip(
                  icon: Icons.update_rounded,
                  label: 'as of ${formatRadarTime(snapshot!.generatedAt)}',
                  color: RadarColors.muted,
                ),
            ],
          ),
          if (stats != null) ...[
            const SizedBox(height: 16),
            StatsHeader(
              stats: codexStats ?? stats!.overall,
              monitor: monitor,
            ),
          ],
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: RadarColors.bg.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: RadarColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 260),
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusLegend extends StatelessWidget {
  const _StatusLegend();

  static const _keys = [
    'active_confirmed',
    'detected_pending',
    'no_recent_confirmed',
    'source_unhealthy',
    'not_monitored',
  ];

  @override
  Widget build(BuildContext context) {
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
          Text(
            'How to read status',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: RadarColors.text,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            '現在：有/沒有 = 確認窗內是否還有公開 RESET。'
            '上次 = 距離最近一次官方公告多久（窗過了仍會顯示）。'
            '灰 ≠ 壞掉。琥珀 = 弱訊號，不要當成 RESET。',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: RadarColors.muted,
                ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final key in _keys)
                StatusPill(status: key),
            ],
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
      padding: EdgeInsets.symmetric(horizontal: pad),
      child: Column(
        children: [
          for (var row = 0; row < 2; row++) ...[
            Row(
              children: [
                for (var c = 0; c < columns; c++) ...[
                  if (c > 0) const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      height: 160,
                      decoration: BoxDecoration(
                        color: RadarColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: RadarColors.border),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: RadarColors.elevated,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Container(
                                  height: 16,
                                  decoration: BoxDecoration(
                                    color: RadarColors.elevated,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Container(
                            height: 28,
                            width: 140,
                            decoration: BoxDecoration(
                              color: RadarColors.elevated,
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                          const Spacer(),
                          Container(
                            height: 12,
                            decoration: BoxDecoration(
                              color: RadarColors.elevated,
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        ],
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
            'Loading public snapshot…',
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
          const Row(
            children: [
              Icon(Icons.error_outline, color: RadarColors.danger),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'Could not load snapshot',
                  style: TextStyle(
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
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _FooterNote extends StatelessWidget {
  const _FooterNote();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Independent utility. Not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google. '
      'A confirmed global RESET does not guarantee your personal quota is full.',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: RadarColors.muted,
            height: 1.5,
          ),
    );
  }
}
