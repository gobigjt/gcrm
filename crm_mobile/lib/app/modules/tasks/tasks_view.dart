import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/utils/ui_format.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import '../../showcase/showcase_widgets.dart';
import 'tasks_controller.dart';

class TasksView extends GetView<TasksController> {
  const TasksView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppNavigationDrawer(currentRoute: AppRoutes.tasks),
      appBar: AppBar(
        title: const Text('Tasks & follow-ups'),
        actions: [
          IconButton(
            onPressed: controller.load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Obx(
              () => AppErrorBanner(
                message: controller.errorMessage.value,
                onRetry: controller.load,
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
                return const Center(child: CircularProgressIndicator());
              }
              if (controller.items.isEmpty) {
                return const Center(child: Text('No tasks yet'));
              }

              DateTime? parseDue(dynamic v) {
                if (v == null) return null;
                final s = v.toString();
                final datePart = s.length >= 10 ? s.substring(0, 10) : s;
                return DateTime.tryParse(datePart);
              }

              final now = DateTime.now();
              final today = DateTime(now.year, now.month, now.day);
              final weekEnd = today.add(const Duration(days: 7));

              final overdue = controller.items
                  .where((f) => !f.isDone && (parseDue(f.dueDate)?.isBefore(today) ?? false))
                  .toList()
                ..sort((a, b) => (parseDue(a.dueDate) ?? today).compareTo(parseDue(b.dueDate) ?? today));

              final todayItems = controller.items
                  .where((f) => !f.isDone && (() {
                        final d = parseDue(f.dueDate);
                        if (d == null) return false;
                        return d.year == today.year && d.month == today.month && d.day == today.day;
                      })())
                  .toList();

              final thisWeek = controller.items
                  .where((f) => !f.isDone && (() {
                        final d = parseDue(f.dueDate);
                        if (d == null) return false;
                        final isAfterToday = d.isAfter(today);
                        final isWithin = d.isBefore(weekEnd.add(const Duration(days: 1))) || d.isAtSameMomentAs(weekEnd);
                        return isAfterToday && isWithin;
                      })())
                  .toList();

              Widget section(String title, int count, Color dotColor, List<CrmFollowupRow> rows) {
                if (rows.isEmpty) return const SizedBox.shrink();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                      child: Row(
                        children: [
                          Container(width: 7, height: 7, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
                          const SizedBox(width: 8),
                          Text(
                            '$title ($count)'.toUpperCase(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: dotColor,
                              letterSpacing: 0.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: rows.map((f) {
                          final score = f.leadScore ?? 0;
                          final value = score > 0 ? formatCurrencyInr(score * 1000) : null;
                          final stage = (f.leadStage ?? '').trim().isEmpty ? 'Task' : f.leadStage!.trim();
                          final sub = title == 'Overdue'
                              ? 'Overdue${value != null ? ' · $value' : ''}'
                              : '$stage${value != null ? ' · $value' : ''}';

                          return ShowcaseListRow(
                            dotColor: dotColor,
                            title: f.description,
                            subtitle: sub,
                            trailing: TextButton(
                              onPressed: controller.isSubmitting.value ? null : () => controller.markDone(f),
                              child: const Text('Done'),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                );
              }

              return RefreshIndicator(
                onRefresh: controller.load,
                child: ListView(
                  children: [
                    section('Overdue', overdue.length, const Color(0xFFE24B4A), overdue),
                    section('Today', todayItems.length, const Color(0xFFEF9F27), todayItems),
                    section('This week', thisWeek.length, const Color(0xFF185FA5), thisWeek),
                    if (overdue.isEmpty && todayItems.isEmpty && thisWeek.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(child: Text('No tasks in these buckets yet')),
                      ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.tasks),
    );
  }
}
