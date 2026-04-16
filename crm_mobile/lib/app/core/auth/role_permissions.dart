/// Backend `roles.name` values (four roles only; see schema.sql / migration 020).
class AppRoles {
  static const admin = 'Admin';
  static const superAdmin = 'Super Admin';
  static const salesManager = 'Sales Manager';
  static const salesExecutive = 'Sales Executive';
  static const hr = 'HR';
}

/// Create / edit / delete CRM follow-up tasks (not mark-done).
bool canManageCrmFollowupTasks(String role) {
  final r = role.trim();
  return r == AppRoles.admin || r == AppRoles.superAdmin || r == AppRoles.salesManager;
}

/// Approve or reject quotations / orders / invoices submitted by sales executives.
bool canApproveSalesDocuments(String role) {
  final r = role.trim();
  return r == AppRoles.admin || r == AppRoles.superAdmin || r == AppRoles.salesManager;
}

class AppPermissions {
  static const dashboard = 'screen.dashboard';
  static const crm = 'screen.crm';
  static const sales = 'screen.sales';
  static const purchase = 'screen.purchase';
  static const inventory = 'screen.inventory';
  static const production = 'screen.production';
  static const finance = 'screen.finance';
  static const hr = 'screen.hr';
  static const settings = 'screen.settings';
  static const users = 'screen.users';
}
