import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import 'hr_controller.dart';

class HrView extends GetView<HrController> {
  const HrView({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        drawer: const AppNavigationDrawer(currentRoute: AppRoutes.hr),
        appBar: AppBar(
          title: const Text('HR & Payroll'),
          bottom: TabBar(
            onTap: (i) => controller.selectedTab.value = i,
            tabs: const [
              Tab(text: 'Employees'),
              Tab(text: 'Attendance'),
              Tab(text: 'Payroll'),
            ],
          ),
          actions: [
            IconButton(onPressed: controller.loadAll, icon: const Icon(Icons.refresh_rounded)),
          ],
        ),
        floatingActionButton: Obx(() {
          if (controller.selectedTab.value == 1) {
            return FloatingActionButton.extended(
              onPressed: () => _openAttendanceSheet(context),
              icon: const Icon(Icons.fact_check_rounded),
              label: const Text('Mark Attendance'),
            );
          }
          if (controller.selectedTab.value == 2) {
            return FloatingActionButton.extended(
              onPressed: () => _openPayrollSheet(context),
              icon: const Icon(Icons.payments_rounded),
              label: const Text('Create Payroll'),
            );
          }
          return const SizedBox.shrink();
        }),
        bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.hr),
        body: Obx(() {
          if (controller.isLoading.value) {
            return const Center(child: CircularProgressIndicator());
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(10),
                child: Obx(
                  () => AppErrorBanner(
                    message: controller.errorMessage.value,
                    onRetry: controller.loadAll,
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _EmployeesTab(
                      controller: controller,
                      onMarkAttendanceForUser: (userId) => _openAttendanceSheet(context, presetUserId: userId),
                    ),
                    _AttendanceTab(controller: controller),
                    _PayrollTab(controller: controller),
                  ],
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Future<void> _openAttendanceSheet(BuildContext context, {int? presetUserId}) async {
    final idCtrl = TextEditingController(
      text: (presetUserId != null && presetUserId > 0) ? '$presetUserId' : '',
    );
    final dateCtrl = TextEditingController(text: DateTime.now().toIso8601String().split('T').first);
    final inCtrl = TextEditingController();
    final outCtrl = TextEditingController();
    final status = 'present'.obs;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Obx(
          () => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: idCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'User ID *',
                  helperText: 'users.id — same user as login; pick from Employees tab or enter manually',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: dateCtrl,
                readOnly: true,
                onTap: () => pickDateIntoController(context: context, controller: dateCtrl),
                decoration: const InputDecoration(
                  labelText: 'Date *',
                  suffixIcon: Icon(Icons.calendar_today_rounded),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: status.value,
                items: const [
                  DropdownMenuItem(value: 'present', child: Text('Present')),
                  DropdownMenuItem(value: 'absent', child: Text('Absent')),
                  DropdownMenuItem(value: 'half_day', child: Text('Half Day')),
                  DropdownMenuItem(value: 'leave', child: Text('Leave')),
                ],
                onChanged: (v) => status.value = v ?? 'present',
                decoration: const InputDecoration(labelText: 'Status'),
              ),
              const SizedBox(height: 8),
              TextField(controller: inCtrl, decoration: const InputDecoration(labelText: 'Check-in (HH:mm)')),
              const SizedBox(height: 8),
              TextField(controller: outCtrl, decoration: const InputDecoration(labelText: 'Check-out (HH:mm)')),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        final uid = int.tryParse(idCtrl.text.trim());
                        if (uid == null || dateCtrl.text.trim().isEmpty) {
                          Get.snackbar('Invalid input', 'User ID and date are required');
                          return;
                        }
                        await controller.markAttendance(
                          userId: uid,
                          date: dateCtrl.text.trim(),
                          status: status.value,
                          checkIn: inCtrl.text.trim(),
                          checkOut: outCtrl.text.trim(),
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save Attendance'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openPayrollSheet(BuildContext context) async {
    final employeeCtrl = TextEditingController();
    final basicCtrl = TextEditingController();
    final hraCtrl = TextEditingController(text: '0');
    final allowanceCtrl = TextEditingController(text: '0');
    final deductionCtrl = TextEditingController(text: '0');
    final pfCtrl = TextEditingController(text: '0');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: employeeCtrl, decoration: const InputDecoration(labelText: 'Employee ID *')),
            const SizedBox(height: 8),
            TextField(controller: basicCtrl, decoration: const InputDecoration(labelText: 'Basic *')),
            const SizedBox(height: 8),
            TextField(controller: hraCtrl, decoration: const InputDecoration(labelText: 'HRA')),
            const SizedBox(height: 8),
            TextField(controller: allowanceCtrl, decoration: const InputDecoration(labelText: 'Allowances')),
            const SizedBox(height: 8),
            TextField(controller: deductionCtrl, decoration: const InputDecoration(labelText: 'Deductions')),
            const SizedBox(height: 8),
            TextField(controller: pfCtrl, decoration: const InputDecoration(labelText: 'PF')),
            const SizedBox(height: 12),
            Obx(
              () => FilledButton(
                onPressed: controller.isSubmitting.value
                    ? null
                    : () async {
                        final id = int.tryParse(employeeCtrl.text.trim());
                        final basic = num.tryParse(basicCtrl.text.trim());
                        if (id == null || basic == null) {
                          Get.snackbar('Invalid input', 'Employee ID and basic are required');
                          return;
                        }
                        await controller.createPayroll(
                          employeeId: id,
                          basic: basic,
                          hra: num.tryParse(hraCtrl.text.trim()) ?? 0,
                          allowances: num.tryParse(allowanceCtrl.text.trim()) ?? 0,
                          deductions: num.tryParse(deductionCtrl.text.trim()) ?? 0,
                          pf: num.tryParse(pfCtrl.text.trim()) ?? 0,
                        );
                        if (context.mounted) Navigator.of(context).pop();
                      },
                child: controller.isSubmitting.value
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save Payroll'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmployeesTab extends StatelessWidget {
  const _EmployeesTab({
    required this.controller,
    required this.onMarkAttendanceForUser,
  });

  final HrController controller;
  final void Function(int userId) onMarkAttendanceForUser;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.employees.isEmpty) return const Center(child: Text('No employees found'));
      return RefreshIndicator(
        onRefresh: controller.loadEmployees,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.employees.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final e = controller.employees[i];
            return Card(
              child: ListTile(
                title: Text(e.title),
                subtitle: Text(
                  '${e.designation} • ${e.department}'
                  '${e.hasLinkedUser ? '\nUser ID ${e.userId} (attendance)' : '\nNo user linked — cannot mark attendance'}',
                ),
                isThreeLine: true,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(e.employeeCode, style: Theme.of(context).textTheme.labelSmall),
                    if (e.hasLinkedUser)
                      IconButton(
                        tooltip: 'Mark attendance',
                        icon: const Icon(Icons.fact_check_outlined),
                        onPressed: () => onMarkAttendanceForUser(e.userId),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      );
    });
  }
}

class _AttendanceTab extends StatelessWidget {
  const _AttendanceTab({required this.controller});
  final HrController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.attendanceSummary.isEmpty) return const Center(child: Text('No attendance summary'));
      return RefreshIndicator(
        onRefresh: controller.loadAttendanceSummary,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.attendanceSummary.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final a = controller.attendanceSummary[i];
            return Card(
              child: ListTile(
                title: Text(a.title),
                subtitle: Text('P ${a.present} • A ${a.absent} • H ${a.halfDay} • L ${a.leave}'),
                trailing: Text(a.employeeCode),
              ),
            );
          },
        ),
      );
    });
  }
}

class _PayrollTab extends StatelessWidget {
  const _PayrollTab({required this.controller});
  final HrController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.payroll.isEmpty) return const Center(child: Text('No payroll for selected month'));
      return RefreshIndicator(
        onRefresh: controller.loadPayroll,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: controller.payroll.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final p = controller.payroll[i];
            final status = p.status;
            return Card(
              child: ListTile(
                title: Text(p.title),
                subtitle: Text('Net: ${formatCurrencyInr(p.net)} • $status'),
                trailing: Wrap(
                  spacing: 6,
                  children: [
                    if (status == 'draft')
                      TextButton(
                        onPressed: () => controller.processPayroll(p.id),
                        child: const Text('Process'),
                      ),
                    if (status == 'processed')
                      TextButton(
                        onPressed: () => controller.payPayroll(p.id),
                        child: const Text('Pay'),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      );
    });
  }
}
