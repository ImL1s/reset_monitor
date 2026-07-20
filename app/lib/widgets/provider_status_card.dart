import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../models/api_models.dart';
import '../theme/radar_theme.dart';
import 'relative_time.dart';
import 'status_visual.dart';

/// One provider's status. Sizes to its content (safe inside an IntrinsicHeight
/// row — never clips). Source health is a first-class colored indicator; the
/// 48h heuristic is deliberately demoted to a neutral, non-alarming block.
class ProviderStatusCard extends StatefulWidget {
  const ProviderStatusCard({
    super.key,
    required this.data,
    this.compact = false,
  });

  final ProviderCardData data;
  final bool compact;

  @override
  State<ProviderStatusCard> createState() => _ProviderStatusCardState();
}

class _ProviderStatusCardState extends State<ProviderStatusCard> {
  bool _hovered = false;

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final data = widget.data;
    final compact = widget.compact;
    final visual = StatusVisual.forStatus(data.displayStatus);
    final event = data.activeEvent ?? data.lastConfirmedEvent;
    final canOpen = event?.sourceUrl.isNotEmpty == true;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: canOpen ? SystemMouseCursors.click : SystemMouseCursors.basic,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _hovered
                ? visual.color.withValues(alpha: 0.55)
                : RadarColors.border,
            width: _hovered ? 1.5 : 1,
          ),
          boxShadow: _hovered
              ? [
                  BoxShadow(
                    color: visual.color.withValues(alpha: 0.12),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
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
            onTap: canOpen ? () => _openUrl(event!.sourceUrl) : null,
            child: Ink(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    RadarColors.surface,
                    visual.color.withValues(alpha: 0.06),
                  ],
                ),
              ),
              child: Padding(
                padding: EdgeInsets.all(compact ? 16 : 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Header(data: data, visual: visual),
                    const SizedBox(height: 14),
                    StatusPill(status: data.displayStatus),
                    if (!data.monitored && data.coverageNote != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        data.coverageNote!,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    if (data.activeEvent != null)
                      _ActiveBlock(l: l, event: data.activeEvent!)
                    else if (data.lastConfirmedEvent != null)
                      _LastResetBlock(l: l, event: data.lastConfirmedEvent!),
                    if (data.pendingDetection != null)
                      _PendingBlock(l: l, detection: data.pendingDetection!),
                    if (data.next48h != null)
                      _Next48hBlock(l: l, forecast: data.next48h!, compact: compact),
                    const SizedBox(height: 16),
                    if (data.monitored) ...[
                      const Divider(height: 1),
                      const SizedBox(height: 12),
                      _FooterMeta(l: l, data: data),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.data, required this.visual});
  final ProviderCardData data;
  final StatusVisual visual;

  @override
  Widget build(BuildContext context) {
    final statusLabel = statusLabelL10n(AppL10n.of(context), data.displayStatus);
    return Row(
      children: [
        Semantics(
          label: 'Status: $statusLabel',
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: visual.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(visual.icon, color: visual.color, size: 22),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.displayName,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text(
                data.provider.toUpperCase(),
                style: radarMono(Theme.of(context).textTheme.labelSmall).copyWith(
                  color: RadarColors.muted,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        ),
        if (data.authorityHint != null)
          _MetaChip(label: data.authorityHint!, icon: Icons.verified_user_outlined),
      ],
    );
  }
}

class _ActiveBlock extends StatelessWidget {
  const _ActiveBlock({required this.l, required this.event});
  final AppL10n l;
  final EventData event;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        Text(
          event.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: t.titleMedium?.copyWith(
            color: RadarColors.text,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (event.bodyExcerpt != null) ...[
          const SizedBox(height: 6),
          Text(
            event.bodyExcerpt!,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: t.bodyMedium,
          ),
        ],
        const SizedBox(height: 10),
        _LinkRow(l: l, url: event.sourceUrl),
        const SizedBox(height: 8),
        Text(
          l.activeUntil(formatRadarTime(event.displayUntil)),
          style: radarMono(t.labelMedium).copyWith(color: RadarColors.accentText),
        ),
        if (event.claimNote != null) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, size: 16, color: RadarColors.warning),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  event.claimNote!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: RadarColors.warning, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _LastResetBlock extends StatelessWidget {
  const _LastResetBlock({required this.l, required this.event});
  final AppL10n l;
  final EventData event;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        Text(
          l.cardLastReset.toUpperCase(),
          style: t.labelSmall?.copyWith(
            color: RadarColors.muted,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          relativeAgo(l, event.announcedAt),
          style: radarMono(t.titleLarge).copyWith(
            color: RadarColors.text,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          event.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: t.bodyMedium?.copyWith(color: RadarColors.text),
        ),
      ],
    );
  }
}

class _PendingBlock extends StatelessWidget {
  const _PendingBlock({required this.l, required this.detection});
  final AppL10n l;
  final PendingDetection detection;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: RadarColors.warning.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: RadarColors.warning.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            const Icon(Icons.hourglass_top_rounded,
                color: RadarColors.warning, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l.pendingWarn(detection.message),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: RadarColors.warning,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Demoted heuristic: neutral surface, muted text — intentionally quiet so it
/// never competes with the confirmed-RESET verdict.
class _Next48hBlock extends StatelessWidget {
  const _Next48hBlock({
    required this.l,
    required this.forecast,
    required this.compact,
  });

  final AppL10n l;
  final Next48hForecast forecast;
  final bool compact;

  String _bandLabel() {
    switch (forecast.band) {
      case 'low':
        return l.bandLow;
      case 'medium':
        return l.bandMedium;
      case 'high':
        return l.bandHigh;
      default:
        return l.bandInsufficient;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final insufficient = forecast.band == 'insufficient_data';
    final headline = insufficient
        ? l.next48hInsufficient
        : forecast.probability == null
            ? _bandLabel()
            : l.next48hLine(_bandLabel(), forecast.probability!);

    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: RadarColors.bg.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: RadarColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.insights_outlined,
                    size: 14, color: RadarColors.muted),
                const SizedBox(width: 6),
                Text(
                  l.next48hTitle.toUpperCase(),
                  style: t.labelSmall?.copyWith(
                    color: RadarColors.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              headline,
              style: radarMono(t.titleMedium).copyWith(
                color: RadarColors.text,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            // Localized default (not the server's fixed zh string) so the whole
            // card stays in the UI language.
            Text(
              l.next48hDisclaimerDefault,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: t.labelSmall?.copyWith(color: RadarColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _FooterMeta extends StatelessWidget {
  const _FooterMeta({required this.l, required this.data});
  final AppL10n l;
  final ProviderCardData data;

  @override
  Widget build(BuildContext context) {
    final healthColor = switch (data.sourceHealth) {
      'fresh' => RadarColors.accent,
      'unknown' || '' => RadarColors.muted,
      _ => RadarColors.warning,
    };
    return Wrap(
      spacing: 14,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: healthColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Text(
              l.sourceHealthChip(data.sourceHealth),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: healthColor,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.schedule_rounded, size: 13, color: RadarColors.muted),
            const SizedBox(width: 5),
            Text(
              l.asOf(formatRadarTime(data.asOf)),
              style: radarMono(Theme.of(context).textTheme.labelSmall)
                  .copyWith(color: RadarColors.muted),
            ),
          ],
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: RadarColors.elevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: RadarColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: RadarColors.muted),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(fontSize: 12, color: RadarColors.muted)),
        ],
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.l, required this.url});
  final AppL10n l;
  final String url;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        const Icon(Icons.link_rounded, size: 16, color: RadarColors.info),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            url,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: radarMono(Theme.of(context).textTheme.labelSmall).copyWith(
              color: RadarColors.info,
              decoration: TextDecoration.underline,
              decorationColor: RadarColors.info,
            ),
          ),
        ),
        Semantics(
          button: true,
          label: l.copyLink,
          child: IconButton(
            tooltip: l.copyLink,
            constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: url));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(l.linkCopied)),
                );
              }
            },
            icon: const Icon(Icons.copy_rounded, size: 18),
          ),
        ),
      ],
    );
  }
}
