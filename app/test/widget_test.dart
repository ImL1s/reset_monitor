import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reset_radar/l10n/app_localizations.dart';
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
      'Not covered',
    );
    expect(formatRadarTime(''), '—');
    expect(formatRadarTime('2026-07-20T12:00:00.000Z').length, greaterThan(8));
  });

  Future<void> pumpLocalized(WidgetTester tester, Locale locale) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        localizationsDelegates: AppL10n.localizationsDelegates,
        supportedLocales: AppL10n.supportedLocales,
        home: Builder(
          builder: (context) => Text(AppL10n.of(context).verdictCalmTitle),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('localizes to Traditional Chinese', (tester) async {
    await pumpLocalized(tester, const Locale('zh'));
    expect(find.text('目前平靜'), findsOneWidget);
  });

  testWidgets('localizes to Japanese', (tester) async {
    await pumpLocalized(tester, const Locale('ja'));
    expect(find.text('現在は静穏'), findsOneWidget);
  });

  testWidgets('localizes to English', (tester) async {
    await pumpLocalized(tester, const Locale('en'));
    expect(find.text('All calm'), findsOneWidget);
  });

  testWidgets('active_banked status is localized, not a raw enum', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppL10n.localizationsDelegates,
        supportedLocales: AppL10n.supportedLocales,
        home: Builder(
          builder: (context) =>
              Text(statusLabelL10n(AppL10n.of(context), 'active_banked')),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('active_banked'), findsNothing);
    expect(find.text('現在：補發券 · 非自動補額'), findsOneWidget);
  });
}
