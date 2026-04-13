import 'package:get/get.dart';

import '../core/auth/role_permissions.dart';
import '../modules/auth/auth_view.dart';
import '../modules/auth/splash_view.dart';
import '../modules/crm/crm_controller.dart';
import '../modules/crm/crm_lead_detail_view.dart';
import '../modules/crm/crm_lists_view.dart';
import '../modules/crm/crm_masters_view.dart';
import '../modules/crm/crm_view.dart';
import '../modules/attendance/sales_attendance_controller.dart';
import '../modules/attendance/sales_attendance_view.dart';
import '../modules/dashboard/dashboard_controller.dart';
import '../modules/dashboard/dashboard_view.dart';
import '../modules/hr/hr_controller.dart';
import '../modules/hr/hr_view.dart';
import '../modules/notifications/notifications_controller.dart';
import '../modules/notifications/notifications_view.dart';
import '../modules/settings/settings_controller.dart';
import '../modules/settings/settings_view.dart';
import '../modules/users/users_controller.dart';
import '../modules/users/users_view.dart';
import '../modules/tasks/tasks_controller.dart';
import '../modules/tasks/tasks_view.dart';
import '../modules/inventory/inventory_controller.dart';
import '../modules/inventory/inventory_view.dart';
import '../modules/sales/invoice_form_view.dart';
import '../modules/sales/order_form_view.dart';
import '../modules/sales/quotation_form_view.dart';
import '../modules/sales/sales_controller.dart';
import '../modules/sales/sales_view.dart';
import '../modules/roles/admin/admin_overview_controller.dart';
import '../modules/roles/admin/company_admin_home_view.dart';
import '../modules/roles/shared/profile_view.dart';
import '../modules/roles/super_admin/platform_home_view.dart';
import '../modules/roles/super_admin/platform_summary_controller.dart';
import '../modules/roles/super_admin/saas_billing_view.dart';
import '../modules/roles/super_admin/tenants_list_view.dart';
import 'app_routes.dart';
import 'permission_middleware.dart';
import 'role_middleware.dart';
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
      name: AppRoutes.attendance,
      page: () => const SalesAttendanceView(),
      binding: BindingsBuilder(() {
        if (!Get.isRegistered<SalesAttendanceController>()) {
          Get.put(SalesAttendanceController());
        }
      }),
      middlewares: [
        RoleMiddleware(allowedRoles: [AppRoles.salesExecutive, AppRoles.salesManager]),
      ],
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
      name: AppRoutes.crmLists,
      page: () => const CrmListsView(),
      middlewares: [PermissionMiddleware(permission: AppPermissions.crm)],
    ),
    GetPage(
      name: AppRoutes.crmMasters,
      page: () => const CrmMastersView(),
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
      name: AppRoutes.quotationForm,
      page: () {
        final args = Get.arguments;
        int? quotationId;
        int? copyFromId;
        int? initialCustomerId;
        if (args is Map) {
          final q = args['quotationId'];
          final c = args['copyFromId'];
          final ic = args['initialCustomerId'];
          if (q is num) quotationId = q.toInt();
          if (c is num) copyFromId = c.toInt();
          if (ic is num) initialCustomerId = ic.toInt();
        }
        return QuotationFormView(
          quotationId: quotationId,
          copyFromId: copyFromId,
          initialCustomerId: initialCustomerId,
        );
      },
      middlewares: [PermissionMiddleware(permission: AppPermissions.sales)],
    ),
    GetPage(
      name: AppRoutes.orderForm,
      page: () {
        int? initialCustomerId;
        final args = Get.arguments;
        if (args is Map) {
          final ic = args['initialCustomerId'];
          if (ic is num) initialCustomerId = ic.toInt();
        }
        return OrderFormView(initialCustomerId: initialCustomerId);
      },
      middlewares: [PermissionMiddleware(permission: AppPermissions.sales)],
    ),
    GetPage(
      name: AppRoutes.invoiceForm,
      page: () {
        int? initialCustomerId;
        int? invoiceId;
        final args = Get.arguments;
        if (args is Map) {
          final ic = args['initialCustomerId'];
          if (ic is num) initialCustomerId = ic.toInt();
          final inv = args['invoiceId'];
          if (inv is num) invoiceId = inv.toInt();
        }
        return InvoiceFormView(initialCustomerId: initialCustomerId, invoiceId: invoiceId);
      },
      middlewares: [PermissionMiddleware(permission: AppPermissions.sales)],
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
      name: AppRoutes.profile,
      page: () => const ProfileView(),
      middlewares: [PermissionMiddleware(permission: AppPermissions.settings)],
    ),
  ];
}
