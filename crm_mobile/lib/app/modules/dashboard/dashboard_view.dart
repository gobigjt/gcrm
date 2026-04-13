import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import '../../showcase/showcase_widgets.dart';
import '../auth/auth_controller.dart';
import '../crm/crm_lead_detail_view.dart';
import 'dashboard_controller.dart';

String _myLeadsHint(DashboardController c) {
  final company7d = c.openLeadsNew7d.value;
  if (company7d > 0) return '$company7d new opens (7d) · company';
  final n = c.newLeadsThisWeek.value;
  final a = c.assignedLeadsCount.value;
  if (n > 0) return '$n new on your book (7d)';
  if (a > 0) return '$a assigned to you';
  return 'Pipeline overview';
}

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  static String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      key: controller.scaffoldKey,
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.dashboard),
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Obx(
              () => ShowcaseHomeTopBar(
                title: '${_greeting()}, ${auth.userName.value}',
                subtitle: 'Your pipeline snapshot',
                avatarInitial: auth.userName.value,
                onOpenMenu: () => controller.scaffoldKey.currentState?.openDrawer(),
                onRefresh: controller.refreshStats,
                notificationBadgeCount: controller.unreadNotifications.value,
                onNotifications: () async {
                  await Get.toNamed(AppRoutes.notifications);
                  await controller.refreshStats();
                },
                onLogout: () => auth.logout(),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: controller.refreshStats,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(11, 8, 11, 100),
                children: [
                  Obx(
                    () => AppErrorBanner(
                      message: controller.errorMessage.value,
                      onRetry: controller.refreshStats,
                    ),
                  ),
                  Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
                  const SizedBox(height: 8),
                  Obx(
                    () => ShowcaseKpiGrid(
                      cells: [
                        ShowcaseKpiCell(
                          label: 'My leads',
                          value: '${controller.openLeads.value}',
                          hint: _myLeadsHint(controller),
                          onTap: () {
                            if (!auth.hasPermission(AppPermissions.crm)) {
                              Get.snackbar('Unavailable', "You don't have access to Leads.");
                              return;
                            }
                            Get.toNamed(AppRoutes.crm);
                          },
                        ),
                        ShowcaseKpiCell(
                          label: 'Won MTD',
                          value: '${controller.activeOrders.value}',
                          hint: 'Active orders (company)',
                          onTap: () {
                            if (!auth.hasPermission(AppPermissions.sales)) {
                              Get.snackbar('Unavailable', "You don't have access to Sales.");
                              return;
                            }
                            Get.toNamed(AppRoutes.sales, arguments: const {'initialTab': 2});
                          },
                        ),
                        ShowcaseKpiCell(
                          label: 'Revenue',
                          value: formatCurrencyInr(controller.revenue.value),
                          hint: 'Paid invoices (company)',
                        ),
                        ShowcaseKpiCell(
                          label: 'Tasks',
                          value: '${controller.tasksCount.value}',
                          hint: controller.tasksOverdueCount.value > 0
                              ? '${controller.tasksOverdueCount.value} overdue'
                              : 'Your follow-ups',
                          valueColor: controller.tasksOverdueCount.value > 0 ? const Color(0xFFE24B4A) : null,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const ShowcaseSectionTitle("Today’s tasks"),
                  Obx(() {
                    final rows = controller.todayTasks;
                    if (rows.isEmpty) {
                      return _DashboardEmptyPlaceholder(
                        icon: Icons.event_available_outlined,
                        title: 'No tasks due today',
                        hint: 'Follow-ups you add in CRM will show up here.',
                      );
                    }
                    return Column(
                      children: rows.map((f) {
                        final dotColor = _isOverdue(f.dueDate) ? const Color(0xFFE24B4A) : const Color(0xFFEF9F27);
                        final stage = (f.leadStage ?? '').trim().isEmpty ? 'Task' : f.leadStage!.trim();
                        final score = f.leadScore ?? 0;
                        final value = score > 0 ? formatCurrencyInr(score * 1000) : null;
                        final subtitle = _isOverdue(f.dueDate)
                            ? 'Overdue${value != null ? ' · $value' : ''}'
                            : '$stage${value != null ? ' · $value' : ''}';
                        return ShowcaseListRow(
                          dotColor: dotColor,
                          title: f.description,
                          subtitle: subtitle,
                        );
                      }).toList(),
                    );
                  }),
                  const SizedBox(height: 20),
                  const ShowcaseSectionTitle('Recent leads'),
                  Obx(() {
                    final list = controller.recentLeads;
                    if (list.isEmpty) {
                      return _DashboardEmptyPlaceholder(
                        icon: Icons.people_outline_rounded,
                        title: 'No recent leads',
                        hint: 'Open Leads to work your pipeline — newest activity appears here.',
                      );
                    }
                    return Column(
                      children: list.map((lead) {
                        return _LeadRow(lead: lead);
                      }).toList(),
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.dashboard),
    );
  }
}

class _DashboardEmptyPlaceholder extends StatelessWidget {
  const _DashboardEmptyPlaceholder({
    required this.icon,
    required this.title,
    required this.hint,
  });

  final IconData icon;
  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          children: [
            Icon(icon, size: 30, color: scheme.onSurfaceVariant.withValues(alpha: 0.9)),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              hint,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                height: 1.35,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _isOverdue(dynamic dueDate) {
  final d = parseLocalCalendarDay(dueDate);
  if (d == null) return false;
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return d.isBefore(today);
}

class _LeadRow extends StatelessWidget {
  const _LeadRow({required this.lead});

  final CrmLead lead;

  String _initials(String s) {
    final parts = s.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
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
    final title = lead.company.isNotEmpty ? lead.company : lead.name;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: () async {
        await Get.to(() => CrmLeadDetailView(leadId: lead.id));
        await Get.find<DashboardController>().refreshStats();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: isDark ? const Color(0xFF1A3A5C) : const Color(0xFFE6F1FB),
              child: Text(
                _initials(title),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isDark ? const Color(0xFF93C5FD) : const Color(0xFF0C447C),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${lead.source} · ${lead.priority}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            ShowcaseStagePill(lead.stage),
          ],
        ),
      ),
    );
  }
}

