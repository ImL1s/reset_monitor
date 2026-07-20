import 'package:flutter/material.dart';

import '../services/radar_api.dart';
import '../theme/radar_theme.dart';

class AboutPage extends StatelessWidget {
  const AboutPage({super.key, required this.apiBase});

  final String apiBase;

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final pad = RadarBreakpoints.pagePadding(w);
    final isWide = w >= RadarBreakpoints.phoneMax;

    return ListView(
      padding: EdgeInsets.all(pad),
      children: [
        Text('About', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'RESET Radar tracks publicly announced AI coding usage hard resets '
          '(for example Codex staff posts and ClaudeDevs announcements). '
          'It does not log into your AI accounts.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 24),
        if (isWide)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _featureCards(context).first),
              const SizedBox(width: 16),
              Expanded(child: _featureCards(context)[1]),
              const SizedBox(width: 16),
              Expanded(child: _featureCards(context)[2]),
            ],
          )
        else
          Column(
            children: [
              for (final card in _featureCards(context)) ...[
                card,
                const SizedBox(height: 12),
              ],
            ],
          ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: RadarColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: RadarColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.api_rounded, color: RadarColors.info, size: 20),
                  const SizedBox(width: 8),
                  Text('API base', style: Theme.of(context).textTheme.titleSmall),
                ],
              ),
              const SizedBox(height: 8),
              SelectableText(
                apiBase,
                style: const TextStyle(color: RadarColors.info, fontSize: 13),
              ),
              const SizedBox(height: 14),
              Text(
                'Independent utility. Not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: RadarColors.muted,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Devices',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'Phone & mobile web: bottom navigation · Tablet: navigation rail · '
          'Desktop web: extended rail + 3-column bento (max content 1200px).',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  List<Widget> _featureCards(BuildContext context) {
    return [
      _FeatureCard(
        icon: Icons.shield_outlined,
        title: 'What “RESET” means',
        body:
            'A confirmed global / staff announcement that many paid users received a usage replenishment — not your personal 5-hour window.',
      ),
      _FeatureCard(
        icon: Icons.lock_open_rounded,
        title: 'Zero login',
        body:
            'The board reads a public API only. Admin confirmation happens out-of-band so green lights stay auditable.',
      ),
      _FeatureCard(
        icon: Icons.devices_rounded,
        title: 'Responsive',
        body:
            'Layouts adapt for phone, tablet, desktop web, and mobile web with touch-first targets (≥44px).',
      ),
    ];
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

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
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: RadarColors.elevated,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: RadarColors.border),
            ),
            child: Icon(icon, color: RadarColors.accent, size: 22),
          ),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(body, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

/// Used when constructing About with default API.
String aboutApiBase() => kDefaultApiBase;
