import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// OLED tech palette from design-system/MASTER.md
abstract final class RadarColors {
  static const bg = Color(0xFF0B1220);
  static const surface = Color(0xFF111827);
  static const elevated = Color(0xFF1E293B);
  static const border = Color(0xFF334155);
  static const text = Color(0xFFF8FAFC);
  static const muted = Color(0xFF94A3B8);
  static const accent = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFF43F5E);
  static const info = Color(0xFF38BDF8);
  static const focus = Color(0xFF38BDF8);

  /// Raised "verdict" surface — one step brighter than [surface] so the
  /// single hero answer reads as the loudest element on the board.
  static const surfaceHi = Color(0xFF16202E);

  /// Brighter green tuned for small text / numbers on dark surfaces (≥4.5:1).
  static const accentText = Color(0xFF4ADE80);
}

/// Monospace style for data, timestamps and the big "Xd ago" number.
/// Gives the board a precise developer-console feel (JetBrains Mono).
TextStyle radarMono(TextStyle? base) => GoogleFonts.jetBrainsMono(textStyle: base);

/// Phone <600 · Tablet 600–1023 · Desktop ≥1024
abstract final class RadarBreakpoints {
  static const phoneMax = 600.0;
  static const tabletMax = 1024.0;
  static const contentMax = 1200.0;
  static const railExtendedMin = 1200.0;

  static bool isPhone(double w) => w < phoneMax;
  static bool isTablet(double w) => w >= phoneMax && w < tabletMax;
  static bool isDesktop(double w) => w >= tabletMax;

  /// Bento grid columns: phone 1 · tablet 2 · desktop 3
  static int gridColumns(double w) {
    if (w < phoneMax) return 1;
    if (w < tabletMax) return 2;
    return 3;
  }

  static double pagePadding(double w) => w < phoneMax ? 16.0 : 24.0;
}

ThemeData buildRadarTheme({required bool reduceMotion}) {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: RadarColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: RadarColors.accent,
      secondary: RadarColors.info,
      surface: RadarColors.surface,
      error: RadarColors.danger,
      onPrimary: Color(0xFF052E16),
      onSurface: RadarColors.text,
      onSecondary: Color(0xFF0C4A6E),
    ),
  );

  final heading = GoogleFonts.spaceGroteskTextTheme(base.textTheme).apply(
    bodyColor: RadarColors.text,
    displayColor: RadarColors.text,
  );
  final body = GoogleFonts.dmSansTextTheme(heading);

  return base.copyWith(
    textTheme: body.copyWith(
      headlineLarge: body.headlineLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
      ),
      headlineMedium: body.headlineMedium?.copyWith(fontWeight: FontWeight.w600),
      headlineSmall: body.headlineSmall?.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: -0.3,
      ),
      titleLarge: body.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      titleMedium: body.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: RadarColors.text,
      ),
      bodyLarge: body.bodyLarge?.copyWith(height: 1.5, fontSize: 16),
      bodyMedium: body.bodyMedium?.copyWith(height: 1.5, color: RadarColors.muted),
      bodySmall: body.bodySmall?.copyWith(height: 1.5, color: RadarColors.muted),
      labelLarge: body.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      labelSmall: body.labelSmall?.copyWith(color: RadarColors.muted),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: RadarColors.bg.withValues(alpha: 0.92),
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      foregroundColor: RadarColors.text,
      titleTextStyle: GoogleFonts.spaceGrotesk(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: RadarColors.text,
      ),
    ),
    cardTheme: CardThemeData(
      color: RadarColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: RadarColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: RadarColors.elevated,
      indicatorColor: RadarColors.accent.withValues(alpha: 0.2),
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600),
      ),
      height: 72,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: RadarColors.accent, size: 24);
        }
        return const IconThemeData(color: RadarColors.muted, size: 24);
      }),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: RadarColors.elevated,
      indicatorColor: RadarColors.accent.withValues(alpha: 0.2),
      selectedIconTheme: const IconThemeData(color: RadarColors.accent),
      unselectedIconTheme: const IconThemeData(color: RadarColors.muted),
      selectedLabelTextStyle: GoogleFonts.dmSans(
        color: RadarColors.accent,
        fontWeight: FontWeight.w600,
      ),
      unselectedLabelTextStyle: GoogleFonts.dmSans(color: RadarColors.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: RadarColors.accent,
        foregroundColor: const Color(0xFF052E16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: RadarColors.text,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: RadarColors.elevated,
      contentTextStyle: GoogleFonts.dmSans(color: RadarColors.text),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerColor: RadarColors.border,
    splashFactory: reduceMotion ? NoSplash.splashFactory : InkSparkle.splashFactory,
    pageTransitionsTheme: reduceMotion
        ? const PageTransitionsTheme(
            builders: {
              TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
              TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
              TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
              TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
              TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
            },
          )
        : base.pageTransitionsTheme,
  );
}

/// Format ISO timestamps for UI chips (local, compact).
String formatRadarTime(String iso) {
  if (iso.isEmpty) return '—';
  try {
    final dt = DateTime.parse(iso).toLocal();
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  } catch (_) {
    return iso.length > 19 ? iso.substring(0, 19) : iso;
  }
}
