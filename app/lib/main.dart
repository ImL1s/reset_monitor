import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Default local API (worker: `npm run dev:local`).
const kDefaultApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://127.0.0.1:8787',
);

void main() {
  runApp(const ResetRadarApp());
}

class ResetRadarApp extends StatelessWidget {
  const ResetRadarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RESET Radar',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
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
  int index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: const [
          BoardPage(),
          TimelinePage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Board',
          ),
          NavigationDestination(
            icon: Icon(Icons.timeline_outlined),
            selectedIcon: Icon(Icons.timeline),
            label: 'Timeline',
          ),
        ],
      ),
    );
  }
}

class BoardPage extends StatefulWidget {
  const BoardPage({super.key});

  @override
  State<BoardPage> createState() => _BoardPageState();
}

class _BoardPageState extends State<BoardPage> {
  final apiBase = kDefaultApiBase;
  Map<String, dynamic>? snapshot;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final res = await http
          .get(Uri.parse('$apiBase/v1/snapshot'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      setState(() {
        snapshot = data;
        loading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final providers =
        (snapshot?['providers'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('RESET Radar'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: loading ? null : refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '打開就看有沒有公開 RESET · 零登入',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              '非官方 · 綠燈≠個人額度 · API: $apiBase',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white70,
                  ),
            ),
            if (snapshot != null) ...[
              const SizedBox(height: 8),
              Text(
                'generated_at: ${snapshot!['generated_at']} · schema ${snapshot!['schema_version']}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
            const SizedBox(height: 16),
            if (loading && snapshot == null)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ),
              ),
            if (error != null) ...[
              Card(
                color: Colors.red.shade900.withValues(alpha: 0.4),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '無法連線 API',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(error!),
                      const SizedBox(height: 8),
                      const Text('請先: cd worker && npm run dev:local'),
                      TextButton(onPressed: refresh, child: const Text('重試')),
                    ],
                  ),
                ),
              ),
            ],
            ...providers.map((p) => ProviderCard(data: p)),
            const SizedBox(height: 24),
            Text(
              'Independent utility. Not affiliated with OpenAI, Anthropic, xAI, Moonshot, z.ai, or Google. Global reset ≠ personal quota.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white54,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class TimelinePage extends StatefulWidget {
  const TimelinePage({super.key});

  @override
  State<TimelinePage> createState() => _TimelinePageState();
}

class _TimelinePageState extends State<TimelinePage> {
  final apiBase = kDefaultApiBase;
  List<Map<String, dynamic>> items = [];
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final res = await http
          .get(Uri.parse('$apiBase/v1/events?limit=50'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (data['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        items = list;
        loading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Timeline'),
        actions: [
          IconButton(onPressed: loading ? null : refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: loading && items.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final e = items[i];
                    final retracted = e['retracted'] == true;
                    return Card(
                      child: ListTile(
                        title: Text(
                          '${e['provider']} · ${e['type']}',
                          style: TextStyle(
                            decoration:
                                retracted ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(e['title'] as String? ?? ''),
                            SelectableText(
                              e['source_url'] as String? ?? '',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.tealAccent,
                              ),
                            ),
                            Text(
                              'verified: ${e['verified_at']}',
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                        isThreeLine: true,
                      ),
                    );
                  },
                ),
    );
  }
}

class ProviderCard extends StatelessWidget {
  const ProviderCard({super.key, required this.data});

  final Map<String, dynamic> data;

  Color _statusColor(String? s) {
    switch (s) {
      case 'active_confirmed':
        return Colors.greenAccent;
      case 'active_confirmed_degraded':
        return Colors.lightGreen;
      case 'detected_pending':
        return Colors.amber;
      case 'source_unhealthy':
        return Colors.redAccent;
      case 'cold_start':
        return Colors.blueGrey;
      case 'not_monitored':
        return Colors.grey;
      default:
        return Colors.white54;
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'active_confirmed':
        return '🟢 顯示期內已確認 RESET';
      case 'active_confirmed_degraded':
        return '🟢⚠ 事件仍有效 · 監測中斷';
      case 'detected_pending':
        return '🟡 待確認';
      case 'no_recent_confirmed':
        return '⚪ 近期無 confirmed';
      case 'source_unhealthy':
        return '⚫ 監測中斷（非「平靜」）';
      case 'cold_start':
        return '🧊 尚無已確認事件';
      case 'not_monitored':
        return '— 尚未監測';
      default:
        return s ?? '?';
    }
  }

  @override
  Widget build(BuildContext context) {
    final name =
        data['display_name'] as String? ?? data['provider'] as String? ?? '?';
    final status = data['display_status'] as String?;
    final health = data['source_health'] as String?;
    final asOf = data['as_of'] as String?;
    final coverage = data['coverage_note'] as String?;
    final active = data['active_event'] as Map<String, dynamic>?;
    final last = data['last_confirmed_event'] as Map<String, dynamic>?;
    final pending = data['pending_detection'] as Map<String, dynamic>?;
    final monitored = data['monitored'] == true;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(name, style: Theme.of(context).textTheme.titleLarge),
                ),
                if (data['authority_hint'] != null)
                  Chip(
                    label: Text('${data['authority_hint']}'),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _statusLabel(status),
              style: TextStyle(
                color: _statusColor(status),
                fontWeight: FontWeight.w600,
              ),
            ),
            if (!monitored && coverage != null) ...[
              const SizedBox(height: 6),
              Text(coverage, style: const TextStyle(color: Colors.white60)),
            ],
            if (active != null) ...[
              const SizedBox(height: 10),
              Text(
                active['title'] as String? ?? '',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              if (active['source_url'] != null)
                SelectableText(
                  active['source_url'] as String,
                  style: const TextStyle(fontSize: 12, color: Colors.tealAccent),
                ),
              Text(
                'display_until: ${active['display_until']}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
              if (active['claim_note'] != null)
                Text(
                  '⚠ ${active['claim_note']}',
                  style: const TextStyle(color: Colors.orangeAccent, fontSize: 12),
                ),
            ] else if (last != null) ...[
              const SizedBox(height: 10),
              Text(
                '上次 confirmed: ${last['title']}',
                style: const TextStyle(color: Colors.white70),
              ),
              Text(
                'verified_at: ${last['verified_at']}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
            if (pending != null) ...[
              const SizedBox(height: 8),
              Text(
                'pending: ${pending['message']}',
                style: const TextStyle(color: Colors.amber, fontSize: 12),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              'as_of: $asOf · health: $health · hb: ${data['last_operator_heartbeat_at'] ?? '—'}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Colors.white54,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
