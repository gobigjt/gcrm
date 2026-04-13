import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/models/dashboard_stats.dart';
import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart' show parseDynamicInt, parseLocalCalendarDay;
import '../attendance/sales_attendance_controller.dart';
import '../auth/auth_controller.dart';

class DashboardController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();
  bool get isSalesManager {
    final r = _auth.role.value.trim().toLowerCase();
    return r == 'sales manager' || r == 'manager';
  }

  /// Matches backend `isSalesExecutiveRole` — pipeline KPI should use scoped `/crm/leads`, not company settings.
  bool get _isSalesExecutiveLike {
    final r = _auth.role.value.trim().toLowerCase();
    return r == 'sales executive' || r == 'agent';
  }

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
    _ensureSalesAttendanceController();
    refreshStats();
  }

  void _ensureSalesAttendanceController() {
    if (_auth.role.value != AppRoles.salesExecutive) return;
    if (!Get.isRegistered<SalesAttendanceController>()) {
      Get.put(SalesAttendanceController());
    }
  }

  /// Idempotent — safe to call from build; registers controller before the home attendance card.
  void registerSalesAttendanceIfNeeded() {
    _ensureSalesAttendanceController();
  }

  Future<void> refreshStats() async {
    _ensureSalesAttendanceController();
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
        final followupsPath = isSalesManager
            ? '/crm/leads/followups'
            : '/crm/leads/followups?assigned_to=$userId';
        final leadsPath = isSalesManager ? '/crm/leads' : '/crm/leads?assigned_to=$userId';
        followupsRaw = (await _auth.authorizedRequest(
          method: 'GET',
          path: followupsPath,
        )) as List;

        // "Recent leads": show recent unconverted leads in the role-scoped pipeline.
        leadsRaw = (await _auth.authorizedRequest(
          method: 'GET',
          path: leadsPath,
        )) as List;
      }

      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data as Map));
      // Company-wide KPI from settings; for Sales Manager / Sales Executive we replace "My leads" from `/crm/leads`
      // so it matches the CRM list (same API, no extra client filters).
      openLeads.value = stats.openLeads;
      revenue.value = stats.revenue;
      activeOrders.value = stats.activeOrders;
      employees.value = stats.totalEmployees;
      openLeadsNew7d.value = stats.openLeadsNew7d;
      overdueInvoices.value = stats.overdueInvoices;
      unreadNotifications.value = parseDynamicInt((unread as Map)['count']);

      if (followupsRaw != null) {
        final followups = followupsRaw
            .map((e) => CrmFollowupRow.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();

        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);

        final overdue = followups.where((f) {
          final d = parseLocalCalendarDay(f.dueDate);
          return d != null && d.isBefore(today) && !f.isDone;
        }).toList();

        tasksCount.value = followups.length;
        tasksOverdueCount.value = overdue.length;

        // Showcase shows a mixed list under "Today's tasks" (overdue + due today).
        final preview = followups
            .where((f) {
              final d = parseLocalCalendarDay(f.dueDate);
              if (d == null || f.isDone) return false;
              return d.isBefore(today.add(const Duration(days: 1))) || d.isAtSameMomentAs(today);
            })
            .toList()
          ..sort((a, b) {
            final da = parseLocalCalendarDay(a.dueDate) ?? today;
            final db = parseLocalCalendarDay(b.dueDate) ?? today;
            return da.compareTo(db);
          });

        todayTasks.assignAll(preview.take(4));
      }

      if (leadsRaw != null) {
        // Same rows as CRM list (`/crm/leads`): do not drop converted leads here or home and list disagree.
        final allAssigned = leadsRaw
            .map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
        assignedLeadsCount.value = allAssigned.length;
        if (isSalesManager || _isSalesExecutiveLike) {
          // "My leads" must match the same scoped list as CRM / recent leads (not company-wide `/settings/dashboard`).
          openLeads.value = allAssigned.length;
        }

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
      await _auth.refreshSalesExecutiveAttendance();
    }
  }
}
