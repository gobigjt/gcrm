import 'package:flutter/material.dart';

import '../../routes/app_routes.dart';

/// Maps backend `users.role` to mobile nav personas (four roles only).
enum ShowcaseRole {
  salesExecutive,
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
    if (r == 'sales executive' || r == 'agent' || r == 'manager' || r == 'sales manager') {
      return ShowcaseRole.salesExecutive;
    }
    if (r == 'hr') return ShowcaseRole.hr;
    return ShowcaseRole.unknown;
  }

  static String label(ShowcaseRole role) {
    return switch (role) {
      ShowcaseRole.salesExecutive => 'Sales executive',
      ShowcaseRole.companyAdmin => 'Company admin',
      ShowcaseRole.superAdmin => 'Super admin',
      ShowcaseRole.hr => 'HR',
      ShowcaseRole.unknown => 'User',
    };
  }

  static List<RoleNavItem> bottomNav(ShowcaseRole role) {
    switch (role) {
      case ShowcaseRole.salesExecutive:
        return const [
          RoleNavItem(route: AppRoutes.dashboard, label: 'Home', icon: Icons.home_rounded),
          RoleNavItem(route: AppRoutes.attendance, label: 'Check-in', icon: Icons.how_to_reg_outlined),
          RoleNavItem(route: AppRoutes.crm, label: 'Leads', icon: Icons.people_alt_outlined),
          RoleNavItem(route: AppRoutes.sales, label: 'Sales', icon: Icons.receipt_long_outlined),
          RoleNavItem(route: AppRoutes.inventory, label: 'Stock', icon: Icons.inventory_2_outlined),
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
    final normalized = path == AppRoutes.crmLists ? AppRoutes.crm : path;
    final items = bottomNav(role);

    for (var i = 0; i < items.length; i++) {
      final r = items[i].route;
      if (normalized == r || normalized.startsWith('$r/')) return i;
    }
    return 0;
  }
}
