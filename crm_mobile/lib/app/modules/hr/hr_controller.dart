import 'package:get/get.dart';

import '../../core/models/hr_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class HrController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final errorMessage = ''.obs;

  final month = DateTime.now().month.obs;
  final year = DateTime.now().year.obs;
  final fromDate = ''.obs;
  final toDate = ''.obs;

  final employees = <HrEmployeeRow>[].obs;
  final attendanceSummary = <AttendanceSummaryRow>[].obs;
  final payroll = <PayrollRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    final now = DateTime.now();
    fromDate.value = '${now.year}-${now.month.toString().padLeft(2, '0')}-01';
    toDate.value = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadEmployees(), loadAttendanceSummary(), loadPayroll()]);
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadEmployees() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/hr/employees');
    employees.assignAll(
      (res as List).map((e) => HrEmployeeRow.fromJson(Map<String, dynamic>.from(e as Map))),
    );
  }

  Future<void> loadAttendanceSummary() async {
    final res = await _auth.authorizedRequest(
      method: 'GET',
      path: '/hr/attendance/summary?from=${fromDate.value}&to=${toDate.value}',
    );
    attendanceSummary.assignAll(
      (res as List).map((e) => AttendanceSummaryRow.fromJson(Map<String, dynamic>.from(e as Map))),
    );
  }

  Future<void> loadPayroll() async {
    final res = await _auth.authorizedRequest(
      method: 'GET',
      path: '/hr/payroll?month=${month.value}&year=${year.value}',
    );
    payroll.assignAll(
      (res as List).map((e) => PayrollRow.fromJson(Map<String, dynamic>.from(e as Map))),
    );
  }

  Future<void> markAttendance({
    required int userId,
    required String date,
    required String status,
    String? checkIn,
    String? checkOut,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/hr/attendance',
        body: {
          'user_id': userId,
          'date': date,
          'status': status,
          'check_in': (checkIn ?? '').trim().isEmpty ? null : checkIn,
          'check_out': (checkOut ?? '').trim().isEmpty ? null : checkOut,
        },
      );
      await loadAttendanceSummary();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> createPayroll({
    required int employeeId,
    required num basic,
    num hra = 0,
    num allowances = 0,
    num deductions = 0,
    num pf = 0,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/hr/payroll',
        body: {
          'employee_id': employeeId,
          'month': month.value,
          'year': year.value,
          'basic': basic,
          'hra': hra,
          'allowances': allowances,
          'deductions': deductions,
          'pf': pf,
        },
      );
      await loadPayroll();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> processPayroll(int payrollId) async {
    await _auth.authorizedRequest(method: 'PATCH', path: '/hr/payroll/$payrollId/process');
    await loadPayroll();
  }

  Future<void> payPayroll(int payrollId) async {
    await _auth.authorizedRequest(method: 'PATCH', path: '/hr/payroll/$payrollId/pay');
    await loadPayroll();
  }
}
