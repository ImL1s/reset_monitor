import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import '../services/radar_api.dart';
import '../theme/radar_theme.dart';

/// Public source repository (shown as a "Source on GitHub" link).
const kRepoUrl = 'https://github.com/ImL1s/reset_monitor';

class AboutPage extends StatelessWidget {
  const AboutPage({super.key, required this.apiBase});

  final String apiBase;

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final w = MediaQuery.sizeOf(context).width;
    final pad = RadarBreakpoints.pagePadding(w);
    final isWide = w >= RadarBreakpoints.phoneMax;

    final cards = _featureCards(l);

    return ListView(
      padding: EdgeInsets.all(pad),
      children: [
        Text(l.aboutTitle, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(l.aboutIntro, style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: 24),
        if (isWide)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < cards.length; i++) ...[
                  if (i > 0) const SizedBox(width: 16),
                  Expanded(child: cards[i]),
                ],
              ],
            ),
          )
        else
          Column(
            children: [
              for (final card in cards) ...[card, const SizedBox(height: 12)],
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
                  Text(l.apiBaseTitle,
                      style: Theme.of(context).textTheme.titleSmall),
                ],
              ),
              const SizedBox(height: 8),
              SelectableText(
                apiBase,
                style: radarMono(Theme.of(context).textTheme.bodySmall)
                    .copyWith(color: RadarColors.info),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: () => launchUrl(
                  Uri.parse(kRepoUrl),
                  mode: LaunchMode.externalApplication,
                ),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.code_rounded,
                          size: 18, color: RadarColors.info),
                      const SizedBox(width: 8),
                      Text(
                        l.sourceOnGitHub,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: RadarColors.info,
                              decoration: TextDecoration.underline,
                              decorationColor: RadarColors.info,
                            ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.open_in_new_rounded,
                          size: 14, color: RadarColors.info),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                l.independentNotice,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: RadarColors.muted,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(l.howToReadTitle, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(l.howToReadBody, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 40),
      ],
    );
  }

  List<Widget> _featureCards(AppL10n l) {
    return [
      _FeatureCard(
        icon: Icons.shield_outlined,
        title: l.featureMeaningTitle,
        body: l.featureMeaningBody,
      ),
      _FeatureCard(
        icon: Icons.auto_mode_rounded,
        title: l.featureAutoTitle,
        body: l.featureAutoBody,
      ),
      _FeatureCard(
        icon: Icons.lock_open_rounded,
        title: l.featureZeroLoginTitle,
        body: l.featureZeroLoginBody,
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
