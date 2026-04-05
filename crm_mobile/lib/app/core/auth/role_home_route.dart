import 'role_permissions.dart';
import 'showcase_role.dart';
import '../../routes/app_routes.dart';

/// First screen after login — four roles only.
String resolveRoleHome({
  required String roleName,
  required bool Function(String permission) hasPermission,
}) {
  final persona = ShowcaseRoles.fromBackendRole(roleName);
  bool can(String p) => hasPermission(p);

  switch (persona) {
    case ShowcaseRole.superAdmin:
      return AppRoutes.platformHome;
    case ShowcaseRole.companyAdmin:
      if (can(AppPermissions.settings) || can(AppPermissions.users)) return AppRoutes.adminHome;
      break;
    case ShowcaseRole.hr:
      if (can(AppPermissions.hr)) return AppRoutes.hr;
      if (can(AppPermissions.dashboard)) return AppRoutes.dashboard;
      break;
    case ShowcaseRole.salesExecutive:
    case ShowcaseRole.unknown:
      break;
  }

  if (can(AppPermissions.dashboard)) return AppRoutes.dashboard;
  if (can(AppPermissions.crm)) return AppRoutes.crm;
  if (can(AppPermissions.sales)) return AppRoutes.sales;
  if (can(AppPermissions.inventory)) return AppRoutes.inventory;
  if (can(AppPermissions.hr)) return AppRoutes.hr;
  if (can(AppPermissions.settings)) return AppRoutes.settings;
  return AppRoutes.dashboard;
}
