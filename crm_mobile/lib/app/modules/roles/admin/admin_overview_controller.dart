import 'package:get/get.dart';

import '../../../core/models/dashboard_stats.dart';
import '../../../core/network/error_utils.dart';
import '../../auth/auth_controller.dart';

/// Company-wide KPIs for the admin home (same dashboard API as sales home).
class AdminOverviewController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final errorMessage = ''.obs;
  final openLeads = 0.obs;
  final revenue = 0.0.obs;
  final activeOrders = 0.obs;
  final employees = 0.obs;
  final overdueInvoices = 0.obs;
  final openLeadsNew7d = 0.obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final data = await _auth.authorizedRequest(method: 'GET', path: '/settings/dashboard');
      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data as Map));
      openLeads.value = stats.openLeads;
      revenue.value = stats.revenue;
      activeOrders.value = stats.activeOrders;
      employees.value = stats.totalEmployees;
      overdueInvoices.value = stats.overdueInvoices;
      openLeadsNew7d.value = stats.openLeadsNew7d;
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }
}
