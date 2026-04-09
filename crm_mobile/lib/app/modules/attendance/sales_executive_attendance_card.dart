import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'sales_attendance_controller.dart';

/// Check-in / check-out card for Sales Executive (home or dedicated screen).
class SalesExecutiveAttendanceCard extends StatelessWidget {
  const SalesExecutiveAttendanceCard({super.key, required this.controller});

  final SalesAttendanceController controller;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Obx(() {
      final cin = controller.attendanceCheckIn.value;
      final cout = controller.attendanceCheckOut.value;
      final busy = controller.attendanceBusy.value;
      final canIn = cin == null && !busy;
      final canOut = cin != null && cout == null && !busy;

      return Material(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.schedule_rounded, size: 20, color: scheme.primary),
                  const SizedBox(width: 8),
                  Text(
                    'Attendance',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Today',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _TimeChip(label: 'Check-in', time: cin, icon: Icons.login_rounded),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _TimeChip(label: 'Check-out', time: cout, icon: Icons.logout_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (busy)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Center(
                    child: SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                  ),
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: canIn ? () => controller.checkInNow() : null,
                        icon: const Icon(Icons.login_rounded, size: 18),
                        label: const Text('Check in'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.tonalIcon(
                        onPressed: canOut ? () => controller.checkOutNow() : null,
                        icon: const Icon(Icons.logout_rounded, size: 18),
                        label: const Text('Check out'),
                      ),
                    ),
                  ],
                ),
              if (controller.attendanceMessage.value.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  controller.attendanceMessage.value,
                  style: TextStyle(fontSize: 12, color: scheme.error),
                ),
              ],
            ],
          ),
        ),
      );
    });
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.label, required this.time, required this.icon});

  final String label;
  final String? time;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final t = time ?? '—';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: scheme.onSurfaceVariant),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: scheme.onSurfaceVariant)),
                Text(
                  t,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: scheme.onSurface),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
