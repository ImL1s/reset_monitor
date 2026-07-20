import '../models/api_models.dart';

/// Lightweight tab-local notifier: tracks last seen event id for pollers.
/// Platform-specific Notification UI is optional; this stores state only.
class LocalResetNotifier {
  String? lastEventId;

  /// Returns true if a newer confirmed event appeared.
  bool checkForNew(TimelineResponse? tl) {
    final items = tl?.items ?? [];
    if (items.isEmpty) return false;
    final newest = items.first.id;
    if (lastEventId == null) {
      lastEventId = newest;
      return false;
    }
    if (newest != lastEventId) {
      lastEventId = newest;
      return true;
    }
    return false;
  }
}
