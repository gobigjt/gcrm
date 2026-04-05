import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/dashboard_stats.dart';
import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class DashboardController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();

  final isLoading = false.obs;
  final openLeads = 0.obs;
  final revenue = 0.0.obs;
  final activeOrders = 0.obs;
  final employees = 0.obs;
  final unreadNotifications = 0.obs;
  final tasksCount = 0.obs;
  final tasksOverdueCount = 0.obs;
  final todayTasks = <CrmFollowupRow>[].obs;
  final recentLeads = <CrmLead>[].obs;
  final errorMessage = ''.obs;
  /// From assigned leads fetch (for KPI subtitles).
  final assignedLeadsCount = 0.obs;
  final newLeadsThisWeek = 0.obs;
  /// From `/settings/dashboard` (company-wide).
  final openLeadsNew7d = 0.obs;
  final overdueInvoices = 0.obs;

  @override
  void onInit() {
    super.onInit();
    refreshStats();
  }

  DateTime? _parseDue(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    final datePart = s.length >= 10 ? s.substring(0, 10) : s;
    return DateTime.tryParse(datePart);
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

      final userId = _auth.userId.value;

      // Tasks + recent leads for the home wireframe.
      // If userId isn't available for some reason, skip these calls.
      List<dynamic>? followupsRaw;
      List<dynamic>? leadsRaw;
      if (userId > 0) {
        followupsRaw = (await _auth.authorizedRequest(
          method: 'GET',
          path: '/crm/leads/followups?assigned_to=$userId',
        )) as List;

        // "Recent leads": show recent unconverted leads. We'll fetch assigned leads and
        // then client-side filter to keep backend changes minimal.
        leadsRaw = (await _auth.authorizedRequest(
          method: 'GET',
          path: '/crm/leads?assigned_to=$userId',
        )) as List;
      }

      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data as Map));
      openLeads.value = stats.openLeads;
      revenue.value = stats.revenue;
      activeOrders.value = stats.activeOrders;
      employees.value = stats.totalEmployees;
      openLeadsNew7d.value = stats.openLeadsNew7d;
      overdueInvoices.value = stats.overdueInvoices;
      unreadNotifications.value = ((unread as Map)['count'] as num? ?? 0).toInt();

      if (followupsRaw != null) {
        final followups = followupsRaw
            .map((e) => CrmFollowupRow.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();

        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);

        final overdue = followups.where((f) {
          final d = _parseDue(f.dueDate);
          return d != null && d.isBefore(today) && !f.isDone;
        }).toList();

        tasksCount.value = followups.length;
        tasksOverdueCount.value = overdue.length;

        // Showcase shows a mixed list under "Today's tasks" (overdue + due today).
        final preview = followups
            .where((f) {
              final d = _parseDue(f.dueDate);
              if (d == null || f.isDone) return false;
              return d.isBefore(today.add(const Duration(days: 1))) || d.isAtSameMomentAs(today);
            })
            .toList()
          ..sort((a, b) {
            final da = _parseDue(a.dueDate) ?? today;
            final db = _parseDue(b.dueDate) ?? today;
            return da.compareTo(db);
          });

        todayTasks.assignAll(preview.take(4));
      }

      if (leadsRaw != null) {
        final rawList = leadsRaw.where((e) {
          final m = e as Map;
          return m['is_converted'] != true;
        }).toList();

        final allAssigned =
            rawList.map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        assignedLeadsCount.value = allAssigned.length;

        final weekAgo = DateTime.now().subtract(const Duration(days: 7));
        newLeadsThisWeek.value = allAssigned.where((l) => !l.createdAt.isBefore(weekAgo)).length;

        // Keep it small for the home preview.
        recentLeads.assignAll(allAssigned.take(4).toList());
      } else {
        assignedLeadsCount.value = 0;
        newLeadsThisWeek.value = 0;
      }
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }
}
