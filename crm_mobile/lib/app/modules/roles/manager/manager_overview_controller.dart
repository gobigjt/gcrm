import 'package:get/get.dart';

import '../../../core/models/crm_models.dart';
import '../../../core/models/dashboard_stats.dart';
import '../../../core/network/error_utils.dart';
import '../../auth/auth_controller.dart';

/// Team-oriented stats for the sales manager home & performance screens.
class ManagerOverviewController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final errorMessage = ''.obs;

  final teamLeads = 0.obs;
  final converted = 0.obs;
  final convRate = ''.obs;
  final revenue = 0.0.obs;
  final overdueFollowups = 0.obs;
  final newLeadsThisWeek = 0.obs;

  final openFollowups = <CrmFollowupRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    refreshAll();
  }

  DateTime? _parseDue(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    final datePart = s.length >= 10 ? s.substring(0, 10) : s;
    return DateTime.tryParse(datePart);
  }

  Future<void> refreshAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final data = await _auth.authorizedRequest(method: 'GET', path: '/settings/dashboard');
      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data as Map));

      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads');
      final leads = (leadsRes as List)
          .map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      final fupsRaw =
          (await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/followups')) as List;
      final followups =
          fupsRaw.map((e) => CrmFollowupRow.fromJson(Map<String, dynamic>.from(e as Map))).toList();

      final won = leads.where((l) => l.stage.toLowerCase().contains('won')).length;
      converted.value = won;
      teamLeads.value = leads.length - won;
      convRate.value =
          leads.isNotEmpty ? '${((won / leads.length) * 100).toStringAsFixed(1)}%' : '—';

      final weekAgo = DateTime.now().subtract(const Duration(days: 7));
      newLeadsThisWeek.value = leads.where((l) => !l.createdAt.isBefore(weekAgo)).length;

      revenue.value = stats.revenue;
      openFollowups.assignAll(followups.take(50));

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      overdueFollowups.value = followups.where((f) {
        if (f.isDone) return false;
        final d = _parseDue(f.dueDate);
        return d != null && d.isBefore(today);
      }).length;
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }
}
