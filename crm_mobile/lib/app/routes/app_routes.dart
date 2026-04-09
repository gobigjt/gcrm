abstract class AppRoutes {
  static const splash = '/splash';
  static const login = '/login';
  static const dashboard = '/dashboard';
  /// Sales Executive — daily check-in / check-out (`/hr/me/attendance/*`).
  static const attendance = '/attendance';
  static const crm = '/crm';
  static const crmLists = '/crm/lists';
  static const sales = '/sales';
  /// Full-screen quotation create/edit (named route avoids web Navigator/GlobalKey issues with `Get.to(() => …)`).
  static const quotationForm = '/quotation/form';
  static const orderForm = '/sales/order/form';
  static const invoiceForm = '/sales/invoice/form';
  static const inventory = '/inventory';
  /// Deep link / notification target: `/lead/123`
  static const leadDetail = '/lead/:id';
  static const tasks = '/tasks';
  static const hr = '/hr';
  static const settings = '/settings';
  static const users = '/users';
  static const notifications = '/notifications';

  /// Company admin persona
  static const adminHome = '/admin/home';

  /// Super admin persona
  static const platformHome = '/platform/home';
  static const tenantsList = '/platform/tenants';
  static const saasBilling = '/platform/billing';

  /// Shared (from settings / profile)
  static const profile = '/profile';
}
