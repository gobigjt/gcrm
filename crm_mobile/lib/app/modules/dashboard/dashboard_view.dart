import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
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
        title: const Text('CRM Dashboard'),
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
                      'Welcome back, ${auth.userName.value}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      auth.role.value,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Pull down to refresh dashboard stats.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 8),
            Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.refreshStats,
              ),
            ),
            Obx(() => controller.isLoading.value ? const LinearProgressIndicator(minHeight: 3) : const SizedBox.shrink()),
            const SizedBox(height: 20),
            Obx(
              () => Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _StatCard(
                    label: 'Open Leads',
                    value: '${controller.openLeads.value}',
                    icon: Icons.track_changes_rounded,
                    tint: const Color(0xFF8B5CF6),
                  ),
                  _StatCard(
                    label: 'Revenue',
                    value: formatCurrencyInr(controller.revenue.value),
                    icon: Icons.payments_rounded,
                    tint: const Color(0xFF10B981),
                  ),
                  _StatCard(
                    label: 'Active Orders',
                    value: '${controller.activeOrders.value}',
                    icon: Icons.shopping_bag_rounded,
                    tint: const Color(0xFFF59E0B),
                  ),
                  _StatCard(
                    label: 'Employees',
                    value: '${controller.employees.value}',
                    icon: Icons.groups_rounded,
                    tint: const Color(0xFF3B82F6),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Accessible Screens',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Obx(
              () => Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _NavChip(
                    label: 'CRM',
                    route: AppRoutes.crm,
                    enabled: auth.hasPermission(AppPermissions.crm),
                  ),
                  _NavChip(
                    label: 'Sales',
                    route: AppRoutes.sales,
                    enabled: auth.hasPermission(AppPermissions.sales),
                  ),
                  _NavChip(
                    label: 'Purchase',
                    route: AppRoutes.purchase,
                    enabled: auth.hasPermission(AppPermissions.purchase),
                  ),
                  _NavChip(
                    label: 'Inventory',
                    route: AppRoutes.inventory,
                    enabled: auth.hasPermission(AppPermissions.inventory),
                  ),
                  _NavChip(
                    label: 'Production',
                    route: AppRoutes.production,
                    enabled: auth.hasPermission(AppPermissions.production),
                  ),
                  _NavChip(
                    label: 'Comms',
                    route: AppRoutes.communication,
                    enabled: auth.hasPermission(AppPermissions.communication),
                  ),
                  _NavChip(
                    label: 'Finance',
                    route: AppRoutes.finance,
                    enabled: auth.hasPermission(AppPermissions.finance),
                  ),
                  _NavChip(
                    label: 'HR',
                    route: AppRoutes.hr,
                    enabled: auth.hasPermission(AppPermissions.hr),
                  ),
                  _NavChip(
                    label: 'Settings',
                    route: AppRoutes.settings,
                    enabled: auth.hasPermission(AppPermissions.settings),
                  ),
                  _NavChip(
                    label: 'Users',
                    route: AppRoutes.users,
                    enabled: auth.hasPermission(AppPermissions.users),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.tint,
  });

  final String label;
  final String value;
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
            ],
          ),
        ),
      ),
    );
  }
}

class _NavChip extends StatelessWidget {
  const _NavChip({
    required this.label,
    required this.route,
    required this.enabled,
  });

  final String label;
  final String route;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      onPressed: enabled ? () => Get.toNamed(route) : null,
      icon: Icon(enabled ? Icons.open_in_new_rounded : Icons.lock_outline_rounded, size: 18),
      label: Text(enabled ? label : '$label (No access)'),
    );
  }
}
