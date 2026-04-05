import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/auth/role_permissions.dart';
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

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.adminHome),
      appBar: AppBar(
        title: const Text('Company overview'),
        actions: [
          IconButton(onPressed: () => controller.load(), icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.adminHome),
      body: RefreshIndicator(
        onRefresh: () => controller.load(),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: () => controller.load(),
              ),
            ),
            Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
            const SizedBox(height: 8),
            Obx(
              () => ShowcaseKpiGrid(
                cells: [
                  ShowcaseKpiCell(
                    label: 'Total leads',
                    value: '${controller.openLeads.value}',
                    hint: controller.openLeadsNew7d.value > 0
                        ? '${controller.openLeadsNew7d.value} new opens (7d)'
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
                    label: 'Headcount',
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
              ),
            ),
            const SizedBox(height: 16),
            const ShowcaseSectionTitle('Alerts'),
            Obx(
              () => ShowcaseListRow(
                dotColor: const Color(0xFFE24B4A),
                title: 'Review overdue invoices',
                subtitle: controller.overdueInvoices.value > 0
                    ? '${controller.overdueInvoices.value} past due · Invoices'
                    : 'None past due',
              ),
            ),
            ShowcaseListRow(
              dotColor: const Color(0xFFEF9F27),
              title: 'Check module access',
              subtitle: 'Users & roles in Settings',
              onTap: () => Get.toNamed(AppRoutes.settings),
            ),
            Obx(
              () => ShowcaseListRow(
                dotColor: const Color(0xFF1D9E75),
                title: 'CRM pipeline',
                subtitle: '${controller.openLeads.value} open leads company-wide',
              ),
            ),
            const SizedBox(height: 16),
            const ShowcaseSectionTitle('Quick actions'),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.people_outline_rounded, color: Color(0xFF185FA5)),
              title: const Text('Users & access'),
              subtitle: const Text('Invite, roles, module toggles'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Get.toNamed(AppRoutes.users),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.settings_rounded, color: Color(0xFF185FA5)),
              title: const Text('Company settings'),
              subtitle: const Text('Profile & company details'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Get.toNamed(AppRoutes.settings),
            ),
          ],
        ),
      ),
    );
  }
}
