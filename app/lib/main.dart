import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'l10n/app_localizations.dart';
import 'pages/about_page.dart';
import 'pages/board_page.dart';
import 'pages/timeline_page.dart';
import 'services/locale_controller.dart';
import 'services/radar_api.dart';
import 'theme/radar_theme.dart';
import 'widgets/responsive_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: RadarColors.elevated,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const ResetRadarApp());
}

class ResetRadarApp extends StatelessWidget {
  const ResetRadarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Locale?>(
      valueListenable: localeController,
      builder: (context, locale, _) {
        return MaterialApp(
          title: 'RESET Radar',
          debugShowCheckedModeBanner: false,
          locale: locale,
          localizationsDelegates: AppL10n.localizationsDelegates,
          supportedLocales: AppL10n.supportedLocales,
          // ThemeBuilder reads MediaQuery.disableAnimations after binding exists.
          builder: (context, child) {
            final reduceMotion = MediaQuery.disableAnimationsOf(context);
            final theme = buildRadarTheme(reduceMotion: reduceMotion);
            return Theme(
              data: theme,
              child: child ?? const SizedBox.shrink(),
            );
          },
          theme: buildRadarTheme(reduceMotion: false),
          home: const HomeShell(),
        );
      },
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final api = RadarApi();
  final boardKey = GlobalKey<BoardPageState>();
  final timelineKey = GlobalKey<TimelinePageState>();
  int index = 0;

  Future<void> _refreshCurrent() async {
    if (index == 0) {
      await boardKey.currentState?.refresh();
    } else if (index == 1) {
      await timelineKey.currentState?.refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final destinations = [
      NavigationDestination(
        icon: const Icon(Icons.grid_view_rounded),
        selectedIcon: const Icon(Icons.grid_view_rounded),
        label: l.navBoard,
      ),
      NavigationDestination(
        icon: const Icon(Icons.timeline_rounded),
        selectedIcon: const Icon(Icons.timeline_rounded),
        label: l.navTimeline,
      ),
      NavigationDestination(
        icon: const Icon(Icons.info_outline_rounded),
        selectedIcon: const Icon(Icons.info_rounded),
        label: l.navAbout,
      ),
    ];

    final titles = [l.navBoard, l.navTimeline, l.navAbout];

    return ResponsiveShell(
      index: index,
      onIndexChanged: (i) => setState(() => index = i),
      destinations: destinations,
      title: 'RESET Radar · ${titles[index]}',
      actions: [
        const _LanguageMenu(),
        if (index < 2)
          IconButton(
            tooltip: l.refresh,
            onPressed: _refreshCurrent,
            icon: const Icon(Icons.refresh_rounded),
          ),
      ],
      body: IndexedStack(
        index: index,
        children: [
          BoardPage(key: boardKey, api: api),
          TimelinePage(key: timelineKey, api: api),
          AboutPage(apiBase: api.baseUrl),
        ],
      ),
    );
  }
}

/// Language picker. Index-based values avoid PopupMenuButton's null-value
/// gotcha (a `null` menu value never fires onSelected), so "System default"
/// (a null locale) stays selectable.
class _LanguageMenu extends StatelessWidget {
  const _LanguageMenu();

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context);
    final current = localeController.value;
    return PopupMenuButton<int>(
      tooltip: l.language,
      icon: const Icon(Icons.translate_rounded),
      color: RadarColors.elevated,
      onSelected: (i) => localeController.value = kPickerLocales[i],
      itemBuilder: (context) => [
        for (var i = 0; i < kPickerLocales.length; i++)
          PopupMenuItem<int>(
            value: i,
            child: Row(
              children: [
                Icon(
                  sameLocaleChoice(current, kPickerLocales[i])
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: 18,
                  color: sameLocaleChoice(current, kPickerLocales[i])
                      ? RadarColors.accent
                      : RadarColors.muted,
                ),
                const SizedBox(width: 10),
                Text(
                  localeLabel(l, kPickerLocales[i]),
                  style: const TextStyle(color: RadarColors.text),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
