import 'package:get/get.dart';

import '../../core/models/dashboard_stats.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class DashboardController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final openLeads = 0.obs;
  final revenue = 0.0.obs;
  final activeOrders = 0.obs;
  final employees = 0.obs;
  final unreadNotifications = 0.obs;
  final errorMessage = ''.obs;

  @override
  void onInit() {
    super.onInit();
    refreshStats();
  }

  Future<void> refreshStats() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final data = await _auth.authorizedRequest(
        method: 'GET',
        path: '/settings/dashboard',
      );
      final unread = await _auth.authorizedRequest(
        method: 'GET',
        path: '/notifications/unread-count',
      );
      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data as Map));
      openLeads.value = stats.openLeads;
      revenue.value = stats.revenue;
      activeOrders.value = stats.activeOrders;
      employees.value = stats.totalEmployees;
      unreadNotifications.value = ((unread as Map)['count'] as num? ?? 0).toInt();
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }
}
