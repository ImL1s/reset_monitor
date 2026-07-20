import 'package:flutter/material.dart';

import '../theme/radar_theme.dart';

/// Compact "recent cadence" bar strip: each past bar is one interval (days
/// between consecutive confirmed hard resets); the optional trailing bar is
/// the current in-progress gap (days since the last reset), drawn in accent so
/// you can see at a glance whether we're "overdue". Signature scannable element.
class SparkBars extends StatelessWidget {
  const SparkBars({
    super.key,
    required this.values,
    this.current,
    this.height = 44,
    this.semanticLabel,
  });

  /// Past interval lengths (days), oldest → newest.
  final List<double> values;

  /// Current gap (days since last reset), rendered as the trailing live bar.
  final double? current;

  final double height;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final bars = <double>[...values, ?current];
    if (bars.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: semanticLabel,
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(
          painter: _SparkPainter(
            values: values,
            current: current,
          ),
        ),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({required this.values, required this.current});

  final List<double> values;
  final double? current;

  @override
  void paint(Canvas canvas, Size size) {
    final all = <double>[...values, ?current];
    if (all.isEmpty) return;
    final maxV = all.reduce((a, b) => a > b ? a : b);
    final safeMax = maxV <= 0 ? 1.0 : maxV;
    final n = all.length;
    const gap = 4.0;
    final barW = ((size.width - gap * (n - 1)) / n).clamp(2.0, 40.0);
    final radius = Radius.circular(barW / 2 > 4 ? 3 : barW / 2);

    for (var i = 0; i < n; i++) {
      final isCurrent = current != null && i == n - 1;
      final v = all[i];
      // Floor at ~12% so even tiny intervals stay visible.
      final h = (v / safeMax).clamp(0.12, 1.0) * size.height;
      final x = i * (barW + gap);
      final rect = RRect.fromRectAndCorners(
        Rect.fromLTWH(x, size.height - h, barW, h),
        topLeft: radius,
        topRight: radius,
      );
      final paint = Paint()
        ..style = PaintingStyle.fill
        ..color = isCurrent
            ? RadarColors.accent
            : RadarColors.muted.withValues(alpha: 0.45);
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(_SparkPainter old) =>
      old.values != values || old.current != current;
}
