import 'package:get/get.dart';

import '../../../core/network/error_utils.dart';
import '../../auth/auth_controller.dart';

/// Loads `GET /settings/platform/summary` (Super Admin only).
class PlatformSummaryController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final errorMessage = ''.obs;

  final activeUsers = 0.obs;
  final leadsTotal = 0.obs;
  final unpaidInvoices = 0.obs;
  final overdueFollowups = 0.obs;
  final activeProducts = 0.obs;
  final warehouses = 0.obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final data = await _auth.authorizedRequest(
        method: 'GET',
        path: '/settings/platform/summary',
      );
      final m = Map<String, dynamic>.from(data as Map);
      activeUsers.value = (m['active_users'] as num? ?? 0).toInt();
      leadsTotal.value = (m['leads_total'] as num? ?? 0).toInt();
      unpaidInvoices.value = (m['unpaid_invoices'] as num? ?? 0).toInt();
      overdueFollowups.value = (m['overdue_followups'] as num? ?? 0).toInt();
      activeProducts.value = (m['active_products'] as num? ?? 0).toInt();
      warehouses.value = (m['warehouses'] as num? ?? 0).toInt();
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }
}
