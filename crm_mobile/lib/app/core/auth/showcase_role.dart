import 'package:flutter/material.dart';

import '../../routes/app_routes.dart';

/// Maps backend `users.role` strings to the six personas in
/// documents/EZcrmcrm_mobile_showcase_1.html (+ HR + unknown).
enum ShowcaseRole {
  salesExecutive,
  salesManager,
  accounts,
  inventoryManager,
  companyAdmin,
  superAdmin,
  hr,
  unknown,
}

@immutable
class RoleNavItem {
  const RoleNavItem({required this.route, required this.label, required this.icon});

  final String route;
  final String label;
  final IconData icon;
}

class ShowcaseRoles {
  ShowcaseRoles._();

  static ShowcaseRole fromBackendRole(String raw) {
    final r = raw.trim().toLowerCase();
    if (r.contains('super') && r.contains('admin')) return ShowcaseRole.superAdmin;
    if (r == 'admin') return ShowcaseRole.companyAdmin;
    if (r == 'sales manager' || r == 'manager') return ShowcaseRole.salesManager;
    if (r == 'sales executive' || r == 'agent') return ShowcaseRole.salesExecutive;
    if (r == 'accountant') return ShowcaseRole.accounts;
    if (r == 'inventory') return ShowcaseRole.inventoryManager;
    if (r == 'hr') return ShowcaseRole.hr;
    return ShowcaseRole.unknown;
  }

  static String label(ShowcaseRole role) {
    return switch (role) {
      ShowcaseRole.salesExecutive => 'Sales executive',
      ShowcaseRole.salesManager => 'Sales manager',
      ShowcaseRole.accounts => 'Accounts',
      ShowcaseRole.inventoryManager => 'Inventory manager',
      ShowcaseRole.companyAdmin => 'Company admin',
      ShowcaseRole.superAdmin => 'Super admin',
      ShowcaseRole.hr => 'HR',
      ShowcaseRole.unknown => 'User',
    };
  }

  /// Bottom navigation for each persona (showcase wireframes).
  static List<RoleNavItem> bottomNav(ShowcaseRole role) {
    switch (role) {
      case ShowcaseRole.salesExecutive:
        return const [
          RoleNavItem(route: AppRoutes.dashboard, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.crm, label: 'Leads', icon: Icons.people_alt_outlined),
          RoleNavItem(route: AppRoutes.tasks, label: 'Tasks', icon: Icons.task_alt_outlined),
          RoleNavItem(route: AppRoutes.communication, label: 'Chat', icon: Icons.chat_bubble_outline_rounded),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.salesManager:
        return const [
          RoleNavItem(route: AppRoutes.managerHome, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.crmKanban, label: 'Kanban', icon: Icons.view_kanban_outlined),
          RoleNavItem(route: AppRoutes.salesPerformance, label: 'Report', icon: Icons.insights_outlined),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.accounts:
        return const [
          RoleNavItem(route: AppRoutes.accountsHome, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.accountsInvoices, label: 'Invoices', icon: Icons.receipt_long_outlined),
          RoleNavItem(route: AppRoutes.accountsGst, label: 'GST', icon: Icons.calculate_outlined),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.inventoryManager:
        return const [
          RoleNavItem(route: AppRoutes.inventoryHome, label: 'Stock', icon: Icons.warehouse_outlined),
          RoleNavItem(route: AppRoutes.inventory, label: 'Inventory', icon: Icons.inventory_2_outlined),
          RoleNavItem(route: AppRoutes.purchase, label: 'Purchase', icon: Icons.shopping_cart_outlined),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.companyAdmin:
        return const [
          RoleNavItem(route: AppRoutes.adminHome, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.users, label: 'Users', icon: Icons.group_outlined),
          RoleNavItem(route: AppRoutes.settings, label: 'Company', icon: Icons.business_outlined),
        ];
      case ShowcaseRole.superAdmin:
        return const [
          RoleNavItem(route: AppRoutes.platformHome, label: 'Platform', icon: Icons.dashboard_outlined),
          RoleNavItem(route: AppRoutes.tenantsList, label: 'Tenants', icon: Icons.apartment_outlined),
          RoleNavItem(route: AppRoutes.saasBilling, label: 'Billing', icon: Icons.payments_outlined),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.hr:
        return const [
          RoleNavItem(route: AppRoutes.dashboard, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.hr, label: 'HR', icon: Icons.badge_outlined),
          RoleNavItem(route: AppRoutes.communication, label: 'Chat', icon: Icons.chat_bubble_outline_rounded),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
      case ShowcaseRole.unknown:
        return const [
          RoleNavItem(route: AppRoutes.dashboard, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.settings, label: 'Me', icon: Icons.person_outline_rounded),
        ];
    }
  }

  static int bottomNavIndex(ShowcaseRole role, String currentRoute) {
    final path = currentRoute.split('?').first;
    final items = bottomNav(role);

    for (var i = 0; i < items.length; i++) {
      final r = items[i].route;
      if (path == r || path.startsWith('$r/')) return i;
    }
    return 0;
  }
}
