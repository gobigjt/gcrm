import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../auth/auth_controller.dart';
import 'manager_overview_controller.dart';

/// Sales manager — "Team overview" (EZcrmcrm_mobile_showcase_1.html).
class ManagerHomeView extends GetView<ManagerOverviewController> {
  const ManagerHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Team overview'),
        actions: [
          IconButton(onPressed: controller.refreshAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.managerHome),
      body: RefreshIndicator(
        onRefresh: controller.refreshAll,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.refreshAll,
              ),
            ),
            Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
            const SizedBox(height: 8),
            Obx(
              () => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: const Color(0xFFE1F5EE),
                      foregroundColor: const Color(0xFF085041),
                      child: Text(
                        _managerInitials(auth.userName.value),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.userName.value.isNotEmpty ? auth.userName.value : 'Manager',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                          ),
                          Text(
                            auth.role.value.isNotEmpty ? auth.role.value : 'Sales Manager',
                            style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Obx(
              () => GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 1.35,
                children: [
                  _kpi(
                    context,
                    'Open pipeline',
                    '${controller.teamLeads.value}',
                    controller.newLeadsThisWeek.value > 0
                        ? '${controller.newLeadsThisWeek.value} new this week'
                        : 'leads in progress',
                  ),
                  _kpi(context, 'Won', '${controller.converted.value}', controller.convRate.value),
                  _kpi(context, 'Revenue', formatCurrencyInr(controller.revenue.value), 'MTD'),
                  _kpi(
                    context,
                    'Overdue FU',
                    '${controller.overdueFollowups.value}',
                    'Action!',
                    valueColor: const Color(0xFFE24B4A),
                    subColor: const Color(0xFFE24B4A),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'TEAM PERFORMANCE',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 8),
            Obx(() {
              final names = <String, int>{};
              for (final f in controller.openFollowups) {
                final n = (f.leadName ?? 'Rep').trim();
                names[n] = (names[n] ?? 0) + 1;
              }
              if (names.isEmpty) {
                return Text(
                  'No open follow-ups. Pull to refresh.',
                  style: TextStyle(color: Theme.of(context).hintColor),
                );
              }
              final entries = names.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
              return Column(
                children: entries.take(5).map((e) {
                  return _memberRow(context, e.key, '${e.value} open tasks');
                }).toList(),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _kpi(
    BuildContext context,
    String label,
    String value,
    String sub, {
    Color? valueColor,
    Color? subColor,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor, fontSize: 11)),
            const Spacer(),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: valueColor,
                  ),
            ),
            Text(
              sub,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                    color: subColor ?? Theme.of(context).hintColor,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _memberRow(BuildContext context, String name, String sub) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFE1F5EE),
        foregroundColor: const Color(0xFF085041),
        child: Text(
          name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
        ),
      ),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      subtitle: Text(sub, style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor)),
    );
  }
}

String _managerInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return 'PM';
  if (parts.length == 1) {
    final t = parts.first;
    return t.length >= 2 ? t.substring(0, 2).toUpperCase() : t[0].toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
