abstract class AppRoutes {
  static const splash = '/splash';
  static const login = '/login';
  static const dashboard = '/dashboard';
  static const crm = '/crm';
  /// Deep link / notification target: `/lead/123`
  static const leadDetail = '/lead/:id';
  static const tasks = '/tasks';
  static const whatsappChat = '/whatsapp/:id';
  static const sales = '/sales';
  static const purchase = '/purchase';
  static const inventory = '/inventory';
  static const production = '/production';
  static const communication = '/communication';
  static const finance = '/finance';
  static const hr = '/hr';
  static const settings = '/settings';
  static const users = '/users';
  static const notifications = '/notifications';

  /// Sales manager persona (showcase)
  static const managerHome = '/manager/home';
  static const crmKanban = '/manager/kanban';
  static const salesPerformance = '/manager/performance';

  /// Accounts persona
  static const accountsHome = '/accounts/home';
  static const accountsInvoices = '/accounts/invoices';
  static const accountsGst = '/accounts/gst';

  /// Inventory persona landing
  static const inventoryHome = '/inventory/home';
  static const stockAdjust = '/inventory/stock-adjust';

  /// Company admin persona
  static const adminHome = '/admin/home';

  /// Super admin persona
  static const platformHome = '/platform/home';
  static const tenantsList = '/platform/tenants';
  static const saasBilling = '/platform/billing';

  /// Shared (from settings / profile)
  static const subscription = '/subscription';
  static const profile = '/profile';
}
