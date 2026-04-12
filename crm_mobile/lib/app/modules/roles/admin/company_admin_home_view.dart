import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/auth/role_permissions.dart';
import '../../../core/models/crm_models.dart';
import '../../../core/utils/ui_format.dart';
import '../../../routes/app_routes.dart';
import '../../auth/auth_controller.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/app_navigation_drawer.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../../showcase/showcase_widgets.dart';
import 'admin_overview_controller.dart';

class CompanyAdminHomeView extends GetView<AdminOverviewController> {
  const CompanyAdminHomeView({super.key});

  static const Color _appBarBg = Color(0xFF263238);

  @override
  Widget build(BuildContext context) {
    final auth   = Get.find<AuthController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs     = Theme.of(context).colorScheme;

    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.adminHome),
      appBar: AppBar(
        backgroundColor: isDark ? cs.surfaceContainerHigh : _appBarBg,
        foregroundColor: isDark ? cs.onSurface : Colors.white,
        iconTheme: IconThemeData(color: isDark ? cs.onSurface : Colors.white),
        actionsIconTheme: IconThemeData(color: isDark ? cs.onSurface : Colors.white),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Company overview',
          style: TextStyle(
            color: isDark ? cs.onSurface : Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Notifications',
            onPressed: () => Get.toNamed(AppRoutes.notifications),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline_rounded),
            tooltip: 'Profile',
            onPressed: () => Get.toNamed(AppRoutes.profile),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
            onPressed: () => _confirmLogout(context, auth),
          ),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.adminHome),
      body: RefreshIndicator(
        onRefresh: () => controller.load(),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            // ── Error banner ───────────────────────────────────────
            Obx(() => AppErrorBanner(
                  message: controller.errorMessage.value,
                  onRetry: () => controller.load(),
                )),
            Obx(() => controller.isLoading.value
                ? const LinearProgressIndicator(minHeight: 2)
                : const SizedBox.shrink()),
            const SizedBox(height: 8),

            // ── KPI grid ───────────────────────────────────────────
            Obx(() => ShowcaseKpiGrid(
                  cells: [
                    ShowcaseKpiCell(
                      label: 'Total leads',
                      value: '${controller.openLeads.value}',
                      hint: controller.openLeadsNew7d.value > 0
                          ? '${controller.openLeadsNew7d.value} new (7d)'
                          : 'Open pipeline',
                      onTap: () {
                        if (!auth.hasPermission(AppPermissions.crm)) {
                          Get.snackbar('Unavailable', "You don't have access to Leads.");
                          return;
                        }
                        Get.toNamed(AppRoutes.crm);
                      },
                    ),
                    ShowcaseKpiCell(
                      label: 'Revenue',
                      value: formatCurrencyInr(controller.revenue.value),
                      hint: 'Paid invoices',
                    ),
                    ShowcaseKpiCell(
                      label: 'Orders',
                      value: '${controller.activeOrders.value}',
                      hint: 'Active (not delivered)',
                      onTap: () {
                        if (!auth.hasPermission(AppPermissions.sales)) {
                          Get.snackbar('Unavailable', "You don't have access to Sales.");
                          return;
                        }
                        Get.toNamed(AppRoutes.sales, arguments: const {'initialTab': 2});
                      },
                    ),
                    ShowcaseKpiCell(
                      label: 'Sales executives',
                      value: '${controller.employees.value}',
                      hint: 'Active employees',
                      onTap: () {
                        if (!auth.hasPermission(AppPermissions.hr)) {
                          Get.snackbar('Unavailable', "You don't have access to HR.");
                          return;
                        }
                        Get.toNamed(AppRoutes.hr);
                      },
                    ),
                  ],
                )),
            const SizedBox(height: 16),

            // ── Alerts ─────────────────────────────────────────────
            const ShowcaseSectionTitle('Alerts'),
            Obx(() => ShowcaseListRow(
                  dotColor: const Color(0xFFE24B4A),
                  title: 'Review overdue invoices',
                  subtitle: controller.overdueInvoices.value > 0
                      ? '${controller.overdueInvoices.value} past due · Invoices'
                      : 'None past due',
                )),
            ShowcaseListRow(
              dotColor: const Color(0xFFEF9F27),
              title: 'Check module access',
              subtitle: 'Users & roles in Settings',
              onTap: () => Get.toNamed(AppRoutes.settings),
            ),
            Obx(() => ShowcaseListRow(
                  dotColor: const Color(0xFF1D9E75),
                  title: 'CRM pipeline',
                  subtitle: '${controller.openLeads.value} open leads company-wide',
                )),
            const SizedBox(height: 16),

            // ── Recent leads ───────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const ShowcaseSectionTitle('Recent leads'),
                TextButton(
                  onPressed: () {
                    if (!auth.hasPermission(AppPermissions.crm)) return;
                    Get.toNamed(AppRoutes.crm);
                  },
                  child: const Text('View all', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
            Obx(() {
              if (controller.isLoading.value && controller.recentLeads.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (controller.recentLeads.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text('No leads yet',
                        style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
                  ),
                );
              }
              return Column(
                children: controller.recentLeads
                    .map((lead) => _LeadCard(lead: lead, auth: auth))
                    .toList(),
              );
            }),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, AuthController auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true) auth.logout();
  }
}

// ─── Recent lead card ─────────────────────────────────────────────────────────

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead, required this.auth});

  final CrmLead     lead;
  final AuthController auth;

  static const _stageColors = <String, Color>{
    'new':        Color(0xFF1976D2),
    'contacted':  Color(0xFF0288D1),
    'qualified':  Color(0xFF388E3C),
    'proposal':   Color(0xFFF57C00),
    'negotiation':Color(0xFFE64A19),
    'won':        Color(0xFF2E7D32),
    'lost':       Color(0xFF757575),
  };

  Color _stageColor() =>
      _stageColors[lead.stage.toLowerCase()] ?? const Color(0xFF78909C);

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final initial = lead.displayTitle.isNotEmpty ? lead.displayTitle[0].toUpperCase() : '?';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: cs.surfaceContainer,
      elevation: isDark ? 0 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade300),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (!auth.hasPermission(AppPermissions.crm)) return;
          Get.toNamed(AppRoutes.crm);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: _stageColor().withValues(alpha: 0.15),
                child: Text(initial,
                    style: TextStyle(
                      color: _stageColor(),
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    )),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lead.displayTitle,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: cs.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (lead.displaySubtitle.isNotEmpty)
                      Text(
                        lead.displaySubtitle,
                        style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _stageColor().withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      lead.stage,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _stageColor(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatIsoDate(lead.createdAt.toIso8601String()),
                    style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
