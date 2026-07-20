import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_models.dart';
import '../theme/radar_theme.dart';
import 'status_visual.dart';

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
                    visual.color.withValues(alpha: 0.07),
                  ],
                ),
              ),
              child: Padding(
                padding: EdgeInsets.all(compact ? 14 : 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Semantics(
                          label: 'Status icon: ${visual.label}',
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
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(
                                      color: RadarColors.muted,
                                      letterSpacing: 1.1,
                                    ),
                              ),
                            ],
                          ),
                        ),
                        if (data.authorityHint != null)
                          _MetaChip(
                            label: data.authorityHint!,
                            icon: Icons.verified_user_outlined,
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    StatusPill(status: data.displayStatus),
                    if (!data.monitored && data.coverageNote != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        data.coverageNote!,
                        maxLines: compact ? 3 : 4,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    if (data.activeEvent != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        data.activeEvent!.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: RadarColors.text,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (data.activeEvent!.bodyExcerpt != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          data.activeEvent!.bodyExcerpt!,
                          maxLines: compact ? 2 : 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      const SizedBox(height: 8),
                      _LinkRow(url: data.activeEvent!.sourceUrl),
                      const SizedBox(height: 6),
                      Text(
                        'Active until ${formatRadarTime(data.activeEvent!.displayUntil)}',
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: RadarColors.accent,
                            ),
                      ),
                      if (data.activeEvent!.claimNote != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.info_outline,
                              size: 16,
                              color: RadarColors.warning,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                data.activeEvent!.claimNote!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: RadarColors.warning,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ] else if (data.lastConfirmedEvent != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        'Last confirmed',
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: RadarColors.muted,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        data.lastConfirmedEvent!.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: RadarColors.text,
                            ),
                      ),
                      Text(
                        formatRadarTime(data.lastConfirmedEvent!.verifiedAt),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                    if (data.pendingDetection != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: RadarColors.warning.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: RadarColors.warning.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.hourglass_top_rounded,
                              color: RadarColors.warning,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Not confirmed yet — do not treat as a RESET. '
                                '${data.pendingDetection!.message}',
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
                    ],
                    const Spacer(),
                    const SizedBox(height: 12),
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _MetaChip(
                          label: 'health ${data.sourceHealth}',
                          icon: Icons.monitor_heart_outlined,
                        ),
                        _MetaChip(
                          label: 'as of ${formatRadarTime(data.asOf)}',
                          icon: Icons.schedule_rounded,
                        ),
                        if (data.lastOperatorHeartbeatAt != null)
                          _MetaChip(
                            label:
                                'hb ${formatRadarTime(data.lastOperatorHeartbeatAt!)}',
                            icon: Icons.favorite_border,
                          ),
                      ],
                    ),
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
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: RadarColors.muted),
          ),
        ],
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.link_rounded, size: 16, color: RadarColors.info),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            url,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: RadarColors.info,
              fontSize: 12,
              decoration: TextDecoration.underline,
              decorationColor: RadarColors.info,
            ),
          ),
        ),
        Semantics(
          button: true,
          label: 'Copy source link',
          child: IconButton(
            tooltip: 'Copy link',
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: url));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Link copied')),
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
