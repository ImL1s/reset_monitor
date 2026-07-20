import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/api_models.dart';

const kDefaultApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://reset-radar.taiwan-traffic.workers.dev',
);

class RadarApi {
  RadarApi({this.baseUrl = kDefaultApiBase});

  final String baseUrl;

  Future<SnapshotResponse> fetchSnapshot() async {
    final res = await http
        .get(Uri.parse('$baseUrl/v1/snapshot'))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw RadarApiException('Snapshot failed (${res.statusCode})');
    }
    return SnapshotResponse.fromJson(
      jsonDecode(res.body) as Map<String, dynamic>,
    );
  }

  Future<TimelineResponse> fetchEvents({
    int limit = 50,
    String? provider,
  }) async {
    final q = StringBuffer('limit=$limit');
    if (provider != null && provider.isNotEmpty) {
      q.write('&provider=$provider');
    }
    final res = await http
        .get(Uri.parse('$baseUrl/v1/events?$q'))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw RadarApiException('Events failed (${res.statusCode})');
    }
    return TimelineResponse.fromJson(
      jsonDecode(res.body) as Map<String, dynamic>,
    );
  }

  Future<StatsResponse> fetchStats() async {
    final res = await http
        .get(Uri.parse('$baseUrl/v1/stats'))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw RadarApiException('Stats failed (${res.statusCode})');
    }
    return StatsResponse.fromJson(
      jsonDecode(res.body) as Map<String, dynamic>,
    );
  }

  Future<Map<String, dynamic>> fetchMonitor() async {
    final res = await http
        .get(Uri.parse('$baseUrl/v1/monitor'))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw RadarApiException('Monitor failed (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}

class RadarApiException implements Exception {
  RadarApiException(this.message);
  final String message;
  @override
  String toString() => message;
}
