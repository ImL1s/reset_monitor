import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'pages/about_page.dart';
import 'pages/board_page.dart';
import 'pages/timeline_page.dart';
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
    return MaterialApp(
      title: 'RESET Radar',
      debugShowCheckedModeBanner: false,
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
    const destinations = [
      NavigationDestination(
        icon: Icon(Icons.grid_view_rounded),
        selectedIcon: Icon(Icons.grid_view_rounded),
        label: 'Board',
      ),
      NavigationDestination(
        icon: Icon(Icons.timeline_rounded),
        selectedIcon: Icon(Icons.timeline_rounded),
        label: 'Timeline',
      ),
      NavigationDestination(
        icon: Icon(Icons.info_outline_rounded),
        selectedIcon: Icon(Icons.info_rounded),
        label: 'About',
      ),
    ];

    const titles = ['Board', 'Timeline', 'About'];

    return ResponsiveShell(
      index: index,
      onIndexChanged: (i) => setState(() => index = i),
      destinations: destinations,
      title: 'RESET Radar · ${titles[index]}',
      actions: [
        if (index < 2)
          IconButton(
            tooltip: 'Refresh',
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
