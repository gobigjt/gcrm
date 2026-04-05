import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/auth/showcase_role.dart';
import '../../modules/auth/auth_controller.dart';
import '../../routes/app_routes.dart';

/// Left navigation drawer (dark header, module list).
class AppNavigationDrawer extends StatelessWidget {
  const AppNavigationDrawer({
    super.key,
    required this.currentRoute,
    this.section,
  });

  final String currentRoute;
  /// When route is shared (e.g. sales / inventory), distinguishes active drawer row.
  final String? section;

  static const Color _headerBg = Color(0xFF2D3E50);

  static String _homeRoute(AuthController auth) {
    final persona = ShowcaseRoles.fromBackendRole(auth.role.value);
    switch (persona) {
      case ShowcaseRole.superAdmin:
        return AppRoutes.platformHome;
      case ShowcaseRole.companyAdmin:
        return AppRoutes.adminHome;
      default:
        return AppRoutes.dashboard;
    }
  }

  void _closeAndGo(String route, {Object? arguments}) {
    Get.back();
    Get.offAllNamed(route, arguments: arguments);
  }

  bool _isSuper(AuthController auth) => auth.role.value == AppRoles.superAdmin;

  bool _selectedHome(AuthController auth) => currentRoute == _homeRoute(auth);

  bool _selected(String route, {String? sec}) {
    if (currentRoute != route) return false;
    if (sec == null) return true;
    return section == sec;
  }

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    final media = MediaQuery.of(context);
    final width = math.min(media.size.width * 0.86, 340.0);

    return Drawer(
      width: width,
      backgroundColor: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _DrawerHeader(auth: auth),
          Expanded(
            child: Obx(() {
              if (_isSuper(auth)) {
                return ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _DrawerTile(
                      icon: Icons.dashboard_outlined,
                      label: 'Platform',
                      selected: _selected(AppRoutes.platformHome),
                      onTap: () => _closeAndGo(AppRoutes.platformHome),
                    ),
                    _DrawerTile(
                      icon: Icons.apartment_outlined,
                      label: 'Tenants',
                      selected: _selected(AppRoutes.tenantsList),
                      onTap: () => _closeAndGo(AppRoutes.tenantsList),
                    ),
                    _DrawerTile(
                      icon: Icons.payments_outlined,
                      label: 'SaaS billing',
                      selected: _selected(AppRoutes.saasBilling),
                      onTap: () => _closeAndGo(AppRoutes.saasBilling),
                    ),
                    const Divider(height: 1),
                    _DrawerTile(
                      icon: Icons.settings_outlined,
                      label: 'Settings',
                      selected: _selected(AppRoutes.settings),
                      onTap: () => _closeAndGo(AppRoutes.settings),
                    ),
                    const Divider(height: 1),
                    _DrawerSignOutTile(
                      onTap: () {
                        Get.back();
                        auth.logout();
                      },
                    ),
                  ],
                );
              }

              return ListView(
                padding: EdgeInsets.zero,
                children: [
                  if (auth.hasPermission(AppPermissions.dashboard)) ...[
                    _DrawerTile(
                      icon: Icons.home_outlined,
                      label: 'Home',
                      selected: _selectedHome(auth),
                      onTap: () => _closeAndGo(_homeRoute(auth)),
                    ),
                    const Divider(height: 1),
                  ],
                  if (auth.hasPermission(AppPermissions.crm)) ...[
                    _DrawerTile(
                      icon: Icons.people_alt_outlined,
                      label: 'Leads',
                      selected: _selected(AppRoutes.crm),
                      onTap: () => _closeAndGo(AppRoutes.crm),
                    ),
                    _DrawerTile(
                      icon: Icons.view_list_outlined,
                      label: 'Lead lists',
                      selected: _selected(AppRoutes.crmLists),
                      onTap: () => _closeAndGo(AppRoutes.crmLists),
                    ),
                  ],
                  if (auth.hasPermission(AppPermissions.sales)) ...[
                    _DrawerTile(
                      icon: Icons.description_outlined,
                      label: 'Quotes',
                      selected: _selected(AppRoutes.sales, sec: 'quotes'),
                      onTap: () => _closeAndGo(AppRoutes.sales, arguments: const {'initialTab': 0}),
                    ),
                    _DrawerTile(
                      icon: Icons.receipt_long_outlined,
                      label: 'Invoices',
                      selected: _selected(AppRoutes.sales, sec: 'invoices'),
                      onTap: () => _closeAndGo(AppRoutes.sales, arguments: const {'initialTab': 1}),
                    ),
                    _DrawerTile(
                      icon: Icons.shopping_bag_outlined,
                      label: 'Orders',
                      selected: _selected(AppRoutes.sales, sec: 'orders'),
                      onTap: () => _closeAndGo(AppRoutes.sales, arguments: const {'initialTab': 2}),
                    ),
                  ],
                  if (auth.hasPermission(AppPermissions.inventory)) ...[
                    _DrawerTile(
                      icon: Icons.inventory_2_outlined,
                      label: 'Products',
                      selected: _selected(AppRoutes.inventory, sec: 'products'),
                      onTap: () => _closeAndGo(AppRoutes.inventory, arguments: const {'initialTab': 0}),
                    ),
                    _DrawerTile(
                      icon: Icons.warehouse_outlined,
                      label: 'Warehouses',
                      selected: _selected(AppRoutes.inventory, sec: 'warehouses'),
                      onTap: () => _closeAndGo(AppRoutes.inventory, arguments: const {'initialTab': 1}),
                    ),
                  ],
                  if (auth.hasPermission(AppPermissions.users)) ...[
                    _DrawerTile(
                      icon: Icons.group_outlined,
                      label: 'Users, roles & permissions',
                      selected: _selected(AppRoutes.users),
                      onTap: () => _closeAndGo(AppRoutes.users),
                    ),
                  ],
                  if (auth.hasPermission(AppPermissions.hr)) ...[
                    _DrawerTile(
                      icon: Icons.badge_outlined,
                      label: 'HR',
                      selected: _selected(AppRoutes.hr),
                      onTap: () => _closeAndGo(AppRoutes.hr),
                    ),
                  ],
                  const Divider(height: 1),
                  if (auth.hasPermission(AppPermissions.settings))
                    _DrawerTile(
                      icon: Icons.settings_outlined,
                      label: 'Settings',
                      selected: _selected(AppRoutes.settings),
                      onTap: () => _closeAndGo(AppRoutes.settings),
                    ),
                  const Divider(height: 1),
                  _DrawerSignOutTile(
                    onTap: () {
                      Get.back();
                      auth.logout();
                    },
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({required this.auth});

  final AuthController auth;

  static Future<PackageInfo>? _packageInfo;

  static Future<PackageInfo> _loadPackageInfo() {
    _packageInfo ??= PackageInfo.fromPlatform();
    return _packageInfo!;
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final name = auth.userName.value;
      final email = auth.userEmail.value;
      final role = auth.role.value.isEmpty ? 'Member' : auth.role.value;
      final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

      return Material(
        color: AppNavigationDrawer._headerBg,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.white,
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppNavigationDrawer._headerBg,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (email.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              email,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 12,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          const SizedBox(height: 6),
                          Text(
                            role,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                FutureBuilder<PackageInfo>(
                  future: _loadPackageInfo(),
                  builder: (context, snap) {
                    final v = snap.data?.version ?? (snap.hasError ? '—' : '…');
                    return Row(
                      children: [
                        Icon(Icons.check_circle_outline, size: 16, color: Colors.white.withValues(alpha: 0.9)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'App version $v · Up to date',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () {
                    Get.snackbar('Sync', 'Your data is up to date.');
                  },
                  child: Row(
                    children: [
                      Icon(Icons.sync_rounded, size: 16, color: Colors.white.withValues(alpha: 0.9)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Tap to sync · Last sync: Now',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }
}

class _DrawerSignOutTile extends StatelessWidget {
  const _DrawerSignOutTile({required this.onTap});

  final VoidCallback onTap;

  static const Color _fg = Color(0xFFB71C1C);

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
      leading: const Icon(Icons.logout_rounded, size: 22, color: _fg),
      title: const Text(
        'Sign out',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: _fg,
        ),
      ),
      onTap: onTap,
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = const Color(0xFF185FA5);
    final fg = selected ? accent : const Color(0xFF37474F);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
      leading: Icon(icon, size: 22, color: fg),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 14,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: fg,
        ),
      ),
      selected: selected,
      selectedTileColor: accent.withValues(alpha: 0.08),
      onTap: onTap,
    );
  }
}
