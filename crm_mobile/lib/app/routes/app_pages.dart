import 'package:get/get.dart';

import '../core/auth/role_permissions.dart';
import '../modules/auth/auth_view.dart';
import '../modules/auth/splash_view.dart';
import '../modules/communication/communication_controller.dart';
import '../modules/communication/communication_view.dart';
import '../modules/crm/crm_controller.dart';
import '../modules/crm/crm_lead_detail_view.dart';
import '../modules/crm/crm_view.dart';
import '../modules/dashboard/dashboard_controller.dart';
import '../modules/dashboard/dashboard_view.dart';
import '../modules/finance/finance_controller.dart';
import '../modules/finance/finance_view.dart';
import '../modules/hr/hr_controller.dart';
import '../modules/hr/hr_view.dart';
import '../modules/inventory/inventory_controller.dart';
import '../modules/inventory/inventory_view.dart';
import '../modules/notifications/notifications_controller.dart';
import '../modules/notifications/notifications_view.dart';
import '../modules/purchase/purchase_controller.dart';
import '../modules/purchase/purchase_view.dart';
import '../modules/production/production_controller.dart';
import '../modules/production/production_view.dart';
import '../modules/sales/sales_controller.dart';
import '../modules/sales/sales_view.dart';
import '../modules/settings/settings_controller.dart';
import '../modules/settings/settings_view.dart';
import '../modules/users/users_controller.dart';
import '../modules/users/users_view.dart';
import '../modules/tasks/tasks_controller.dart';
import '../modules/tasks/tasks_view.dart';
import '../modules/whatsapp_chat/whatsapp_chat_controller.dart';
import '../modules/whatsapp_chat/whatsapp_chat_view.dart';
import '../modules/roles/admin/admin_overview_controller.dart';
import '../modules/roles/admin/company_admin_home_view.dart';
import '../modules/roles/accounts/accounts_gst_report_view.dart';
import '../modules/roles/accounts/accounts_home_view.dart';
import '../modules/roles/accounts/accounts_invoices_view.dart';
import '../modules/roles/inventory/inventory_role_home_view.dart';
import '../modules/roles/inventory/stock_adjust_view.dart';
import '../modules/roles/manager/crm_kanban_view.dart';
import '../modules/roles/manager/manager_home_view.dart';
import '../modules/roles/manager/manager_overview_controller.dart';
import '../modules/roles/manager/sales_performance_view.dart';
import '../modules/roles/shared/profile_view.dart';
import '../modules/roles/shared/subscription_view.dart';
import '../modules/roles/super_admin/platform_home_view.dart';
import '../modules/roles/super_admin/platform_summary_controller.dart';
import '../modules/roles/super_admin/saas_billing_view.dart';
import '../modules/roles/super_admin/tenants_list_view.dart';
import 'app_routes.dart';
import 'permission_middleware.dart';
import 'super_admin_middleware.dart';

abstract class AppPages {
  static final routes = <GetPage<dynamic>>[
    GetPage(
      name: AppRoutes.splash,
      page: () => const SplashView(),
    ),
    GetPage(
      name: AppRoutes.login,
      page: () => const AuthView(),
    ),
    GetPage(
      name: AppRoutes.dashboard,
      page: () => const DashboardView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<DashboardController>(() => DashboardController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.dashboard)],
    ),
    GetPage(
      name: AppRoutes.crm,
      page: () => const CrmView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<CrmController>(() => CrmController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.leadDetail,
      page: () {
        final id = int.tryParse(Get.parameters['id'] ?? '') ?? 0;
        return CrmLeadDetailView(leadId: id);
      },
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.tasks,
      page: () => const TasksView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<TasksController>(() => TasksController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.sales,
      page: () => const SalesView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<SalesController>(() => SalesController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.sales)],
    ),
    GetPage(
      name: AppRoutes.purchase,
      page: () => const PurchaseView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<PurchaseController>(() => PurchaseController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.purchase)],
    ),
    GetPage(
      name: AppRoutes.inventory,
      page: () => const InventoryView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<InventoryController>(() => InventoryController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.inventory)],
    ),
    GetPage(
      name: AppRoutes.production,
      page: () => const ProductionView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<ProductionController>(() => ProductionController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.production)],
    ),
    GetPage(
      name: AppRoutes.communication,
      page: () => const CommunicationView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<CommunicationController>(() => CommunicationController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.communication)],
    ),
    GetPage(
      name: AppRoutes.whatsappChat,
      page: () => const WhatsAppChatView(),
      binding: BindingsBuilder(() {
        final id = int.tryParse(Get.parameters['id'] ?? '') ?? 0;
        Get.put<WhatsAppChatController>(WhatsAppChatController(leadId: id));
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.communication)],
    ),
    GetPage(
      name: AppRoutes.finance,
      page: () => const FinanceView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<FinanceController>(() => FinanceController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.finance)],
    ),
    GetPage(
      name: AppRoutes.hr,
      page: () => const HrView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<HrController>(() => HrController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.hr)],
    ),
    GetPage(
      name: AppRoutes.settings,
      page: () => const SettingsView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<SettingsController>(() => SettingsController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.settings)],
    ),
    GetPage(
      name: AppRoutes.users,
      page: () => const UsersView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<UsersController>(() => UsersController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.users)],
    ),
    GetPage(
      name: AppRoutes.notifications,
      page: () => const NotificationsView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<NotificationsController>(() => NotificationsController());
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.dashboard)],
    ),

    // Showcase personas — Sales manager
    GetPage(
      name: AppRoutes.managerHome,
      page: () => const ManagerHomeView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<ManagerOverviewController>(() => ManagerOverviewController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.crmKanban,
      page: () => const CrmKanbanView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<CrmController>(() => CrmController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.salesPerformance,
      page: () => const SalesPerformanceView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<ManagerOverviewController>(() => ManagerOverviewController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),

    // Accounts
    GetPage(
      name: AppRoutes.accountsHome,
      page: () => const AccountsHomeView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<FinanceController>(() => FinanceController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.finance)],
    ),
    GetPage(
      name: AppRoutes.accountsInvoices,
      page: () => const AccountsInvoicesView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<FinanceController>(() => FinanceController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.finance)],
    ),
    GetPage(
      name: AppRoutes.accountsGst,
      page: () => const AccountsGstReportView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<FinanceController>(() => FinanceController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.finance)],
    ),

    // Inventory persona home
    GetPage(
      name: AppRoutes.inventoryHome,
      page: () => const InventoryRoleHomeView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<InventoryController>(() => InventoryController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.inventory)],
    ),
    GetPage(
      name: AppRoutes.stockAdjust,
      page: () => const StockAdjustView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<InventoryController>(() => InventoryController(), fenix: true);
      }),
      middlewares: [PermissionMiddleware(permission: AppPermissions.inventory)],
    ),

    // Company admin
    GetPage(
      name: AppRoutes.adminHome,
      page: () => const CompanyAdminHomeView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<AdminOverviewController>(() => AdminOverviewController(), fenix: true);
      }),
      middlewares: [
        PermissionMiddleware(permission: AppPermissions.users),
      ],
    ),

    // Super admin (role gate + any permission bypass not needed)
    GetPage(
      name: AppRoutes.platformHome,
      page: () => const PlatformHomeView(),
      binding: BindingsBuilder(() {
        Get.lazyPut<PlatformSummaryController>(() => PlatformSummaryController());
      }),
      middlewares: [SuperAdminMiddleware()],
    ),
    GetPage(
      name: AppRoutes.tenantsList,
      page: () => const TenantsListView(),
      middlewares: [SuperAdminMiddleware()],
    ),
    GetPage(
      name: AppRoutes.saasBilling,
      page: () => const SaasBillingView(),
      middlewares: [SuperAdminMiddleware()],
    ),

    GetPage(
      name: AppRoutes.subscription,
      page: () => const SubscriptionView(),
      middlewares: [PermissionMiddleware(permission: AppPermissions.settings)],
    ),
    GetPage(
      name: AppRoutes.profile,
      page: () => const ProfileView(),
      middlewares: [PermissionMiddleware(permission: AppPermissions.settings)],
    ),
  ];
}
