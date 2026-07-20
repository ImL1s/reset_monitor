import '../l10n/app_localizations.dart';

/// Human "how long ago" for an ISO timestamp, localized (e.g. "3d ago" /
/// "3 天前" / "3日前"). Falls back to the raw string if unparseable.
String relativeAgo(AppL10n l, String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return iso;
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return l.justNow;
  if (d.inMinutes < 60) return l.agoMinutes('${d.inMinutes}');
  if (d.inHours < 48) return l.agoHours('${d.inHours}');
  final days = d.inHours / 24.0;
  return l.agoDays(_compactDays(days));
}

/// Same, but from a pre-computed day count (stats `days_since_last`).
String relativeDays(AppL10n l, double days) {
  if (days < 1) {
    final h = (days * 24).round();
    return h < 1 ? l.justNow : l.agoHours('$h');
  }
  return l.agoDays(_compactDays(days));
}

/// 1 decimal under 10 days, whole number beyond — matches codex-resets cadence.
String _compactDays(double days) =>
    days < 10 ? days.toStringAsFixed(1) : days.round().toString();
