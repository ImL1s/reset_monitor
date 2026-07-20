import 'package:flutter/material.dart';

import '../theme/radar_theme.dart';

/// Adaptive chrome:
/// - Phone / mobile web (<600): AppBar + bottom NavigationBar
/// - Tablet (600–1023): compact NavigationRail + top bar
/// - Desktop web (≥1024): extended rail when ≥1200, content max 1200px
class ResponsiveShell extends StatelessWidget {
  const ResponsiveShell({
    super.key,
    required this.index,
    required this.onIndexChanged,
    required this.destinations,
    required this.body,
    this.title = 'RESET Radar',
    this.actions = const [],
  });

  final int index;
  final ValueChanged<int> onIndexChanged;
  final List<NavigationDestination> destinations;
  final Widget body;
  final String title;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final phone = RadarBreakpoints.isPhone(w);
        final desktop = RadarBreakpoints.isDesktop(w);
        final extended = desktop && w >= RadarBreakpoints.railExtendedMin;

        if (phone) {
          return Scaffold(
            appBar: AppBar(
              title: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: RadarColors.accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: RadarColors.accent.withValues(alpha: 0.35),
                      ),
                    ),
                    child: const Icon(
                      Icons.radar_rounded,
                      size: 18,
                      color: RadarColors.accent,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      title,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              actions: actions,
            ),
            body: SafeArea(child: body),
            bottomNavigationBar: NavigationBar(
              selectedIndex: index,
              onDestinationSelected: onIndexChanged,
              destinations: destinations,
            ),
          );
        }

        // Tablet + desktop: rail
        return Scaffold(
          body: Row(
            children: [
              Semantics(
                label: 'Main navigation',
                child: NavigationRail(
                  extended: extended,
                  minExtendedWidth: 200,
                  selectedIndex: index,
                  onDestinationSelected: onIndexChanged,
                  labelType: extended
                      ? NavigationRailLabelType.none
                      : NavigationRailLabelType.all,
                  leading: Padding(
                    padding: const EdgeInsets.only(top: 16, bottom: 24),
                    child: Column(
                      children: [
                        Tooltip(
                          message: 'RESET Radar',
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: RadarColors.accent.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: RadarColors.accent.withValues(alpha: 0.4),
                              ),
                            ),
                            child: const Icon(
                              Icons.radar_rounded,
                              color: RadarColors.accent,
                            ),
                          ),
                        ),
                        if (extended) ...[
                          const SizedBox(height: 12),
                          Text(
                            'RESET Radar',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                  color: RadarColors.text,
                                  height: 1.2,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  destinations: [
                    for (final d in destinations)
                      NavigationRailDestination(
                        icon: d.icon,
                        selectedIcon: d.selectedIcon ?? d.icon,
                        label: Text(d.label),
                      ),
                  ],
                ),
              ),
              const VerticalDivider(width: 1, thickness: 1),
              Expanded(
                child: Column(
                  children: [
                    Material(
                      color: RadarColors.bg.withValues(alpha: 0.95),
                      child: SafeArea(
                        bottom: false,
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: RadarBreakpoints.pagePadding(w),
                            vertical: 12,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  title,
                                  style: Theme.of(context).textTheme.headlineSmall,
                                ),
                              ),
                              ...actions,
                            ],
                          ),
                        ),
                      ),
                    ),
                    const Divider(height: 1),
                    Expanded(
                      child: Align(
                        alignment: Alignment.topCenter,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: RadarBreakpoints.contentMax,
                          ),
                          child: body,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
