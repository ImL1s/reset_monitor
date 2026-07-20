class SnapshotResponse {
  SnapshotResponse({
    required this.schemaVersion,
    required this.generatedAt,
    required this.providers,
  });

  final int schemaVersion;
  final String generatedAt;
  final List<ProviderCardData> providers;

  factory SnapshotResponse.fromJson(Map<String, dynamic> json) {
    final list = (json['providers'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .map(ProviderCardData.fromJson)
        .toList();
    return SnapshotResponse(
      schemaVersion: json['schema_version'] as int? ?? 1,
      generatedAt: json['generated_at'] as String? ?? '',
      providers: list,
    );
  }
}

class ForecastFactor {
  ForecastFactor({
    required this.id,
    required this.label,
    required this.delta,
  });

  final String id;
  final String label;
  final int delta;

  factory ForecastFactor.fromJson(Map<String, dynamic> json) => ForecastFactor(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        delta: (json['delta'] as num?)?.toInt() ?? 0,
      );
}

/// Server heuristic only — never a green confirmation.
class Next48hForecast {
  Next48hForecast({
    required this.windowHours,
    required this.band,
    required this.factors,
    required this.calculatedAt,
    required this.method,
    required this.disclaimer,
    this.probability,
    this.evidenceUrls,
  });

  final int windowHours;
  final int? probability;
  final String band;
  final List<ForecastFactor> factors;
  final String calculatedAt;
  final String method;
  final String disclaimer;
  final List<String>? evidenceUrls;

  factory Next48hForecast.fromJson(Map<String, dynamic> json) {
    final rawFactors = (json['factors'] as List? ?? []).cast<dynamic>();
    final factors = rawFactors
        .whereType<Map<String, dynamic>>()
        .map(ForecastFactor.fromJson)
        .toList();
    final urls = (json['evidence_urls'] as List?)
        ?.map((e) => e.toString())
        .toList();
    return Next48hForecast(
      windowHours: (json['window_hours'] as num?)?.toInt() ?? 48,
      probability: (json['probability'] as num?)?.toInt(),
      band: json['band'] as String? ?? 'insufficient_data',
      factors: factors,
      calculatedAt: json['calculated_at'] as String? ?? '',
      method: json['method'] as String? ?? 'deterministic_v1',
      disclaimer: json['disclaimer'] as String? ?? '',
      evidenceUrls: urls,
    );
  }

  static Next48hForecast? tryParse(Map<String, dynamic>? json) {
    if (json == null) return null;
    return Next48hForecast.fromJson(json);
  }

  String get bandLabelZh {
    switch (band) {
      case 'low':
        return '低';
      case 'medium':
        return '中';
      case 'high':
        return '高';
      case 'insufficient_data':
        return '資料不足';
      default:
        return band;
    }
  }
}

class ProviderCardData {
  ProviderCardData({
    required this.provider,
    required this.displayName,
    required this.monitored,
    required this.displayStatus,
    required this.sourceHealth,
    required this.asOf,
    this.lastOperatorHeartbeatAt,
    this.lastSuccessfulIngestAt,
    this.authorityHint,
    this.coverageNote,
    this.staleReason,
    this.activeEvent,
    this.lastConfirmedEvent,
    this.pendingDetection,
    this.next48h,
  });

  final String provider;
  final String displayName;
  final bool monitored;
  final String displayStatus;
  final String sourceHealth;
  final String asOf;
  final String? lastOperatorHeartbeatAt;
  final String? lastSuccessfulIngestAt;
  final String? authorityHint;
  final String? coverageNote;
  final String? staleReason;
  final EventData? activeEvent;
  final EventData? lastConfirmedEvent;
  final PendingDetection? pendingDetection;
  final Next48hForecast? next48h;

  factory ProviderCardData.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? asMap(dynamic v) =>
        v is Map<String, dynamic> ? v : null;
    return ProviderCardData(
      provider: json['provider'] as String? ?? '?',
      displayName: json['display_name'] as String? ?? '?',
      monitored: json['monitored'] == true,
      displayStatus: json['display_status'] as String? ?? 'unknown',
      sourceHealth: json['source_health'] as String? ?? 'unknown',
      asOf: json['as_of'] as String? ?? '',
      lastOperatorHeartbeatAt: json['last_operator_heartbeat_at'] as String?,
      lastSuccessfulIngestAt: json['last_successful_ingest_at'] as String?,
      authorityHint: json['authority_hint'] as String?,
      coverageNote: json['coverage_note'] as String?,
      staleReason: json['stale_reason'] as String?,
      activeEvent: EventData.tryParse(asMap(json['active_event'])),
      lastConfirmedEvent: EventData.tryParse(asMap(json['last_confirmed_event'])),
      pendingDetection: PendingDetection.tryParse(asMap(json['pending_detection'])),
      next48h: Next48hForecast.tryParse(asMap(json['next_48h'])),
    );
  }
}

class EventData {
  EventData({
    required this.id,
    required this.type,
    required this.title,
    required this.sourceUrl,
    required this.displayUntil,
    required this.verifiedAt,
    this.effectiveAt,
    this.bodyExcerpt,
    this.claimNote,
    this.retracted = false,
    this.provider,
  });

  final String id;
  final String type;
  final String title;
  final String sourceUrl;
  final String displayUntil;
  final String verifiedAt;
  /// Announcement time (prefer for "last public reset" display).
  final String? effectiveAt;
  final String? bodyExcerpt;
  final String? claimNote;
  final bool retracted;
  final String? provider;

  /// Prefer announcement clock over import/verify clock.
  String get announcedAt =>
      (effectiveAt != null && effectiveAt!.isNotEmpty) ? effectiveAt! : verifiedAt;

  static EventData? tryParse(Map<String, dynamic>? json) {
    if (json == null) return null;
    return EventData(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      title: json['title'] as String? ?? '',
      sourceUrl: json['source_url'] as String? ?? '',
      displayUntil: json['display_until'] as String? ?? '',
      verifiedAt: json['verified_at'] as String? ?? '',
      effectiveAt: json['effective_at'] as String?,
      bodyExcerpt: json['body_excerpt'] as String?,
      claimNote: json['claim_note'] as String?,
      retracted: json['retracted'] == true,
      provider: json['provider'] as String?,
    );
  }
}

class PendingDetection {
  PendingDetection({
    required this.candidateId,
    required this.message,
    required this.sourceUrl,
    required this.createdAt,
  });

  final String candidateId;
  final String message;
  final String sourceUrl;
  final String createdAt;

  static PendingDetection? tryParse(Map<String, dynamic>? json) {
    if (json == null) return null;
    return PendingDetection(
      candidateId: json['candidate_id'] as String? ?? '',
      message: json['message'] as String? ?? 'Pending',
      sourceUrl: json['source_url'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}

class TimelineResponse {
  TimelineResponse({required this.items, required this.asOf});

  final List<EventData> items;
  final String asOf;

  factory TimelineResponse.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] as List? ?? []).cast<Map<String, dynamic>>();
    return TimelineResponse(
      asOf: json['as_of'] as String? ?? '',
      items: raw.map((e) => EventData.tryParse(e)!).toList(),
    );
  }
}

class ProviderStats {
  ProviderStats({
    required this.provider,
    required this.totalConfirmed,
    required this.hardResetCount,
    required this.bankedCreditCount,
    this.lastResetAt,
    this.daysSinceLast,
    this.avgIntervalDays,
    this.longestDroughtDays,
  });

  final String provider;
  final int totalConfirmed;
  final int hardResetCount;
  final int bankedCreditCount;
  final String? lastResetAt;
  final double? daysSinceLast;
  final double? avgIntervalDays;
  final double? longestDroughtDays;

  factory ProviderStats.fromJson(Map<String, dynamic> json) => ProviderStats(
        provider: json['provider'] as String? ?? 'all',
        totalConfirmed: json['total_confirmed'] as int? ?? 0,
        hardResetCount: json['hard_reset_count'] as int? ?? 0,
        bankedCreditCount: json['banked_credit_count'] as int? ?? 0,
        lastResetAt: json['last_reset_at'] as String?,
        daysSinceLast: (json['days_since_last'] as num?)?.toDouble(),
        avgIntervalDays: (json['avg_interval_days'] as num?)?.toDouble(),
        longestDroughtDays: (json['longest_drought_days'] as num?)?.toDouble(),
      );
}

class StatsResponse {
  StatsResponse({
    required this.asOf,
    required this.overall,
    required this.providers,
  });

  final String asOf;
  final ProviderStats overall;
  final List<ProviderStats> providers;

  factory StatsResponse.fromJson(Map<String, dynamic> json) => StatsResponse(
        asOf: json['as_of'] as String? ?? '',
        overall: ProviderStats.fromJson(
          (json['overall'] as Map<String, dynamic>? ?? {}),
        ),
        providers: ((json['providers'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .map(ProviderStats.fromJson)
            .toList(),
      );
}
