import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_bottom_nav.dart';
import '../auth/auth_controller.dart';
import 'dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('eZCRM Dashboard'),
        actions: [
          Obx(
            () => IconButton(
              onPressed: () async {
                await Get.toNamed(AppRoutes.notifications);
                await controller.refreshStats();
              },
              tooltip: 'Notifications',
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications_none_rounded),
                  if (controller.unreadNotifications.value > 0)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        child: Text(
                          controller.unreadNotifications.value > 99
                              ? '99+'
                              : '${controller.unreadNotifications.value}',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          IconButton(
            onPressed: controller.refreshStats,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
          IconButton(
            onPressed: auth.logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: controller.refreshStats,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Obx(
              () => Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isDark
                        ? const [Color(0xFF1E3A8A), Color(0xFF312E81)]
                        : const [Color(0xFF3B82F6), Color(0xFF7C3AED)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Good morning, ${auth.userName.value}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.refreshStats,
              ),
            ),
            Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 3) : const SizedBox.shrink()),
            const SizedBox(height: 18),
            Obx(
              () => Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _StatCard(
                    label: 'My leads',
                    value: '${controller.openLeads.value}',
                    icon: Icons.track_changes_rounded,
                    tint: const Color(0xFF8B5CF6),
                  ),
                  _StatCard(
                    label: 'Won MTD',
                    value: '${controller.activeOrders.value}',
                    icon: Icons.trending_up_rounded,
                    tint: const Color(0xFF27500A),
                  ),
                  _StatCard(
                    label: 'Revenue',
                    value: formatCurrencyInr(controller.revenue.value),
                    icon: Icons.payments_rounded,
                    tint: const Color(0xFF10B981),
                  ),
                  _StatCard(
                    label: 'Tasks',
                    value: '${controller.tasksCount.value}',
                    hint: controller.tasksOverdueCount.value > 0 ? '${controller.tasksOverdueCount.value} overdue' : null,
                    icon: Icons.task_alt_rounded,
                    tint: const Color(0xFFE24B4A),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Today\'s tasks',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Obx(() {
              final rows = controller.todayTasks;
              if (rows.isEmpty) return const Text('No tasks due today');
              return Column(
                children: rows.map((f) {
                  final dotColor = _isOverdue(f.dueDate) ? const Color(0xFFE24B4A) : const Color(0xFFEF9F27);
                  final stage = (f.leadStage ?? '').trim().isEmpty ? 'Task' : f.leadStage!.trim();
                  final score = f.leadScore ?? 0;
                  final value = score > 0 ? formatCurrencyInr(score * 1000) : null;
                  final subtitle = _isOverdue(f.dueDate)
                      ? 'Overdue${value != null ? ' · $value' : ''}'
                      : '$stage${value != null ? ' · $value' : ''}';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _TaskRow(
                      dotColor: dotColor,
                      title: f.description,
                      subtitle: subtitle,
                    ),
                  );
                }).toList(),
              );
            }),
            const SizedBox(height: 18),
            Text(
              'Recent leads',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Obx(() {
              final list = controller.recentLeads;
              if (list.isEmpty) return const Text('No recent leads');
              return Column(
                children: list.map((lead) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _LeadRow(lead: lead),
                  );
                }).toList(),
              );
            }),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: 0),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    this.hint,
    required this.icon,
    required this.tint,
  });

  final String label;
  final String value;
  final String? hint;
  final IconData icon;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: tint.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: tint, size: 20),
              ),
              const SizedBox(height: 10),
              Text(label, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              if (hint != null) ...[
                const SizedBox(height: 6),
                Text(
                  hint!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: tint,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

bool _isOverdue(dynamic dueDate) {
  if (dueDate == null) return false;
  final s = dueDate.toString();
  final datePart = s.length >= 10 ? s.substring(0, 10) : s;
  final d = DateTime.tryParse(datePart);
  if (d == null) return false;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return d.isBefore(today);
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({
    required this.dotColor,
    required this.title,
    required this.subtitle,
  });

  final Color dotColor;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LeadRow extends StatelessWidget {
  const _LeadRow({required this.lead});

  final CrmLead lead;

  String _initials(String s) {
    final parts = s.trim().split(RegExp(r'\\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final t = parts.first;
      if (t.length >= 2) return t.substring(0, 2).toUpperCase();
      return t.substring(0, 1).toUpperCase();
    }
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {},
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: const Color(0xFFE6F1FB),
            child: Text(
              _initials(lead.company.isNotEmpty ? lead.company : lead.name),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0C447C)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lead.company.isNotEmpty ? lead.company : lead.name,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${lead.source} · ${lead.priority}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFE6F1FB),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              lead.stage,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0C447C)),
            ),
          ),
        ],
      ),
    );
  }
}
