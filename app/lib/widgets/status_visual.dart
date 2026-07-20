import 'package:flutter/material.dart';

import '../theme/radar_theme.dart';

class StatusVisual {
  StatusVisual({
    required this.label,
    required this.color,
    required this.icon,
  });

  final String label;
  final Color color;
  final IconData icon;

  static StatusVisual forStatus(String status) {
    switch (status) {
      case 'active_confirmed':
        return StatusVisual(
          label: 'Confirmed public RESET',
          color: RadarColors.accent,
          icon: Icons.check_circle_rounded,
        );
      case 'active_confirmed_degraded':
        return StatusVisual(
          label: 'Confirmed · feed delayed',
          color: const Color(0xFFA3E635),
          icon: Icons.warning_amber_rounded,
        );
      case 'detected_pending':
        return StatusVisual(
          label: 'Signal only · not a RESET',
          color: RadarColors.warning,
          icon: Icons.hourglass_top_rounded,
        );
      case 'no_recent_confirmed':
        return StatusVisual(
          label: 'No active public RESET window',
          color: RadarColors.muted,
          icon: Icons.remove_circle_outline_rounded,
        );
      case 'source_unhealthy':
        return StatusVisual(
          label: 'Monitoring interrupted',
          color: RadarColors.danger,
          icon: Icons.cloud_off_rounded,
        );
      case 'cold_start':
        return StatusVisual(
          label: 'No confirmed events yet',
          color: const Color(0xFF64748B),
          icon: Icons.ac_unit_rounded,
        );
      case 'not_monitored':
        return StatusVisual(
          label: 'Not covered',
          color: RadarColors.muted,
          icon: Icons.visibility_off_rounded,
        );
      default:
        return StatusVisual(
          label: status,
          color: RadarColors.muted,
          icon: Icons.help_outline_rounded,
        );
    }
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final v = StatusVisual.forStatus(status);
    return Semantics(
      label: 'Status: ${v.label}',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: v.color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: v.color.withValues(alpha: 0.45)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(v.icon, size: 18, color: v.color),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                v.label,
                style: TextStyle(
                  color: v.color,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
