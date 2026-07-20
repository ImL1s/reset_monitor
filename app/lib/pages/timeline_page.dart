import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_models.dart';
import '../services/radar_api.dart';
import '../theme/radar_theme.dart';

class TimelinePage extends StatefulWidget {
  const TimelinePage({super.key, required this.api});

  final RadarApi api;

  @override
  State<TimelinePage> createState() => TimelinePageState();
}

class TimelinePageState extends State<TimelinePage> {
  TimelineResponse? data;
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
      final res = await widget.api.fetchEvents();
      if (!mounted) return;
      setState(() {
        data = res;
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
    final width = MediaQuery.sizeOf(context).width;
    final pad = RadarBreakpoints.pagePadding(width);
    final items = data?.items ?? [];
    final isDesktop = RadarBreakpoints.isDesktop(width);

    return RefreshIndicator(
      color: RadarColors.accent,
      onRefresh: refresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(pad, pad, pad, 8),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Confirmed timeline',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Only auto-confirmed public resets (last 90 days). '
                    'Pending detections stay on the Board — they never appear here.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (data != null)
                    Text(
                      'as of ${formatRadarTime(data!.asOf)}',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                ],
              ),
            ),
          ),
          if (loading && items.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: RadarColors.accent),
                    SizedBox(height: 16),
                    Text('Loading events…', style: TextStyle(color: RadarColors.muted)),
                  ],
                ),
              ),
            )
          else if (error != null && items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(pad),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_rounded, color: RadarColors.danger, size: 40),
                      const SizedBox(height: 12),
                      Text(error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: refresh,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.inbox_outlined,
                      size: 40,
                      color: RadarColors.muted.withValues(alpha: 0.8),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No confirmed events yet',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'When rules (or optional LLM) auto-confirm a public post, it shows up here. '
                      'Amber “detected, not confirmed” items stay on the Board only.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: EdgeInsets.fromLTRB(pad, 8, pad, 32),
              sliver: SliverList.separated(
                itemCount: items.length,
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemBuilder: (context, i) {
                  final e = items[i];
                  return Align(
                    alignment: Alignment.topCenter,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: isDesktop ? 800 : double.infinity,
                      ),
                      child: _TimelineTile(
                        event: e,
                        showConnector: i < items.length - 1,
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _TimelineTile extends StatefulWidget {
  const _TimelineTile({required this.event, required this.showConnector});

  final EventData event;
  final bool showConnector;

  @override
  State<_TimelineTile> createState() => _TimelineTileState();
}

class _TimelineTileState extends State<_TimelineTile> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final showConnector = widget.showConnector;
    final retracted = event.retracted;
    final canOpen = event.sourceUrl.isNotEmpty;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: retracted ? RadarColors.muted : RadarColors.accent,
                    shape: BoxShape.circle,
                    boxShadow: retracted
                        ? null
                        : [
                            BoxShadow(
                              color: RadarColors.accent.withValues(alpha: 0.35),
                              blurRadius: 8,
                            ),
                          ],
                  ),
                ),
                if (showConnector)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: RadarColors.border,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: MouseRegion(
              onEnter: (_) => setState(() => _hovered = true),
              onExit: (_) => setState(() => _hovered = false),
              cursor: canOpen
                  ? SystemMouseCursors.click
                  : SystemMouseCursors.basic,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOut,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _hovered
                        ? RadarColors.accent.withValues(alpha: 0.45)
                        : RadarColors.border,
                  ),
                  boxShadow: _hovered
                      ? [
                          BoxShadow(
                            color: RadarColors.accent.withValues(alpha: 0.08),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : null,
                ),
                child: Material(
                  color: RadarColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: canOpen
                        ? () => launchUrl(
                              Uri.parse(event.sourceUrl),
                              mode: LaunchMode.externalApplication,
                            )
                        : null,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _chip(
                                (event.provider ?? 'event').toUpperCase(),
                                RadarColors.info,
                              ),
                              _chip(
                                _typeLabel(event.type),
                                _typeColor(event.type),
                              ),
                              if (retracted)
                                _chip('RETRACTED', RadarColors.danger),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            event.title,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  decoration: retracted
                                      ? TextDecoration.lineThrough
                                      : null,
                                  color: RadarColors.text,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'announced ${formatRadarTime(event.announcedAt)}',
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                          if (event.sourceUrl.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              event.sourceUrl,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: RadarColors.info,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'banked_credit':
        return 'BANKED';
      case 'hard_reset':
        return 'HARD RESET';
      default:
        return type.toUpperCase();
    }
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'banked_credit':
        return RadarColors.info;
      case 'hard_reset':
        return RadarColors.accent;
      case 'policy_change':
        return RadarColors.warning;
      default:
        return RadarColors.muted;
    }
  }
}
