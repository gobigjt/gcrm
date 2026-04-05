import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_routes.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../shared/widgets/app_navigation_drawer.dart';
import '../../../shared/widgets/role_aware_bottom_nav.dart';
import '../../../showcase/showcase_colors.dart';
import '../../../showcase/showcase_widgets.dart';
import 'platform_summary_controller.dart';

/// Platform overview — KPIs from `/settings/platform/summary` when available.
class PlatformHomeView extends GetView<PlatformSummaryController> {
  const PlatformHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.platformHome),
      appBar: AppBar(
        title: const Text('Platform overview'),
        actions: [
          IconButton(onPressed: controller.load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.platformHome),
      body: Obx(() {
        if (controller.isLoading.value && controller.leadsTotal.value == 0 && controller.errorMessage.value.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }
        return RefreshIndicator(
          onRefresh: controller.load,
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              Obx(
                () => AppErrorBanner(
                  message: controller.errorMessage.value,
                  onRetry: controller.load,
                ),
              ),
              Obx(
                () => ShowcaseKpiGrid(
                  cells: [
                    ShowcaseKpiCell(
                      label: 'Active users',
                      value: '${controller.activeUsers.value}',
                      hint: 'In this tenant',
                    ),
                    ShowcaseKpiCell(
                      label: 'Leads',
                      value: '${controller.leadsTotal.value}',
                      hint: 'All stages',
                    ),
                    ShowcaseKpiCell(
                      label: 'Unpaid inv.',
                      value: '${controller.unpaidInvoices.value}',
                      hint: 'AR snapshot',
                    ),
                    ShowcaseKpiCell(
                      label: 'Overdue FU',
                      value: '${controller.overdueFollowups.value}',
                      hint: 'Follow-ups',
                      valueColor: controller.overdueFollowups.value > 0 ? ShowcaseColors.red : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Catalog · ${controller.activeProducts.value} SKUs · ${controller.warehouses.value} warehouses',
                style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
              ),
              const SizedBox(height: 16),
              const ShowcaseSectionTitle('Plan mix (illustrative)'),
              _bar(context, 'Free tier', 0.47, const Color(0xFFB4B2A9)),
              _bar(context, 'Basic', 0.33, const Color(0xFF378ADD)),
              _bar(context, 'Premium', 0.19, ShowcaseColors.accent),
              const SizedBox(height: 16),
              const ShowcaseSectionTitle('Platform alerts'),
              ShowcaseListRow(
                dotColor: ShowcaseColors.red,
                title: 'Connect billing webhooks',
                subtitle: 'Stripe / Razorpay callbacks',
              ),
              ShowcaseListRow(
                dotColor: ShowcaseColors.amber,
                title: 'Review overdue follow-ups',
                subtitle: '${controller.overdueFollowups.value} open · past due',
              ),
              ShowcaseListRow(
                dotColor: ShowcaseColors.green,
                title: 'Tenant data health',
                subtitle: '${controller.leadsTotal.value} leads · ${controller.unpaidInvoices.value} unpaid invoices',
                onTap: () => Get.toNamed(AppRoutes.tenantsList),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => Get.toNamed(AppRoutes.tenantsList),
                icon: const Icon(Icons.apartment_rounded),
                label: const Text('Browse tenants (demo)'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => Get.toNamed(AppRoutes.saasBilling),
                icon: const Icon(Icons.payments_outlined),
                label: const Text('SaaS billing (demo)'),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _bar(BuildContext context, String label, double pct, Color c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
              Text('${(pct * 100).round()}%', style: TextStyle(fontSize: 11, color: c, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: Theme.of(context).dividerColor,
              color: c,
            ),
          ),
        ],
      ),
    );
  }
}
