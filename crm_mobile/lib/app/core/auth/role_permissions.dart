/// Backend `roles.name` values (see backend/src/database/schema.sql).
class AppRoles {
  static const admin = 'Admin';
  static const superAdmin = 'Super Admin';
  static const manager = 'Manager';
  static const salesManager = 'Sales Manager';
  static const agent = 'Agent';
  static const salesExecutive = 'Sales Executive';
  static const accountant = 'Accountant';
  static const inventory = 'Inventory';
  static const hr = 'HR';
}

class AppPermissions {
  static const dashboard = 'screen.dashboard';
  static const crm = 'screen.crm';
  static const sales = 'screen.sales';
  static const purchase = 'screen.purchase';
  static const inventory = 'screen.inventory';
  static const production = 'screen.production';
  static const communication = 'screen.communication';
  static const finance = 'screen.finance';
  static const hr = 'screen.hr';
  static const settings = 'screen.settings';
  static const users = 'screen.users';
}
