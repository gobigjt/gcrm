/// Backend `roles.name` values (four roles only; see schema.sql / migration 020).
class AppRoles {
  static const admin = 'Admin';
  static const superAdmin = 'Super Admin';
  static const salesExecutive = 'Sales Executive';
  static const hr = 'HR';
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
