import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reset_radar/main.dart';
import 'package:reset_radar/theme/radar_theme.dart';
import 'package:reset_radar/widgets/responsive_shell.dart';
import 'package:reset_radar/widgets/status_visual.dart';

void main() {
  testWidgets('RESET Radar shell renders Board destination', (tester) async {
    await tester.pumpWidget(const ResetRadarApp());
    await tester.pump();
    expect(find.textContaining('RESET Radar'), findsWidgets);
    expect(find.byType(MaterialApp), findsOneWidget);
  });

  testWidgets('phone shell uses bottom NavigationBar', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: buildRadarTheme(reduceMotion: true),
        home: ResponsiveShell(
          index: 0,
          onIndexChanged: (_) {},
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.grid_view_rounded),
              label: 'Board',
            ),
            NavigationDestination(
              icon: Icon(Icons.timeline_rounded),
              label: 'Timeline',
            ),
            NavigationDestination(
              icon: Icon(Icons.info_outline_rounded),
              label: 'About',
            ),
          ],
          body: const Center(child: Text('body')),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
    expect(find.text('body'), findsOneWidget);
  });

  testWidgets('desktop shell uses NavigationRail', (tester) async {
    tester.view.physicalSize = const Size(1400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: buildRadarTheme(reduceMotion: true),
        home: ResponsiveShell(
          index: 1,
          onIndexChanged: (_) {},
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.grid_view_rounded),
              label: 'Board',
            ),
            NavigationDestination(
              icon: Icon(Icons.timeline_rounded),
              label: 'Timeline',
            ),
            NavigationDestination(
              icon: Icon(Icons.info_outline_rounded),
              label: 'About',
            ),
          ],
          body: const Center(child: Text('desktop-body')),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('desktop-body'), findsOneWidget);
  });

  test('status visual maps known statuses', () {
    expect(
      StatusVisual.forStatus('active_confirmed').icon,
      Icons.check_circle_rounded,
    );
    expect(
      StatusVisual.forStatus('not_monitored').label,
      'Not monitored',
    );
    expect(formatRadarTime(''), '—');
    expect(formatRadarTime('2026-07-20T12:00:00.000Z').length, greaterThan(8));
  });
}
