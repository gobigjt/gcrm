import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

/// Sales Executive self-service attendance (`/hr/me/attendance/*`).
class SalesAttendanceController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final attendanceCheckIn = RxnString();
  final attendanceCheckOut = RxnString();
  final attendanceBusy = false.obs;
  final attendanceMessage = ''.obs;

  Future<void> refreshTodayAttendance() async {
    if (_auth.role.value != AppRoles.salesExecutive) return;
    attendanceMessage.value = '';
    try {
      final res = Map<String, dynamic>.from(
        await _auth.authorizedRequest(method: 'GET', path: '/hr/me/attendance/today') as Map,
      );
      final att = res['attendance'];
      if (att is Map) {
        final m = Map<String, dynamic>.from(att);
        attendanceCheckIn.value = _fmtTime(m['check_in']);
        attendanceCheckOut.value = _fmtTime(m['check_out']);
      } else {
        attendanceCheckIn.value = null;
        attendanceCheckOut.value = null;
      }
    } catch (e) {
      attendanceMessage.value = userFriendlyError(e);
    }
  }

  String? _fmtTime(dynamic v) {
    if (v == null) return null;
    var s = v is String ? v.trim() : v.toString().trim();
    if (s.isEmpty) return null;
    // Some JSON stacks (e.g. web) may stringify TIME as part of an ISO-like string.
    final t = s.indexOf('T');
    if (t >= 0 && s.length > t + 5) {
      s = s.substring(t + 1);
    }
    final colon = s.indexOf(':');
    if (colon >= 1 && s.length >= colon + 2) {
      final h24 = int.tryParse(s.substring(0, colon).trim());
      final min = int.tryParse(s.substring(colon + 1, colon + 3).trim());
      if (h24 != null && min != null && h24 >= 0 && h24 < 24 && min >= 0 && min < 60) {
        final ap = h24 >= 12 ? 'PM' : 'AM';
        var h12 = h24 % 12;
        if (h12 == 0) h12 = 12;
        return '$h12:${min.toString().padLeft(2, '0')} $ap';
      }
    }
    if (s.length >= 5) return s.substring(0, 5);
    return s;
  }

  Future<void> checkInNow() async {
    if (_auth.role.value != AppRoles.salesExecutive) return;
    attendanceBusy.value = true;
    attendanceMessage.value = '';
    try {
      final res = Map<String, dynamic>.from(
        await _auth.authorizedRequest(method: 'POST', path: '/hr/me/attendance/check-in') as Map,
      );
      final att = Map<String, dynamic>.from(res['attendance'] as Map);
      attendanceCheckIn.value = _fmtTime(att['check_in']);
      attendanceCheckOut.value = _fmtTime(att['check_out']);
      Get.snackbar('Attendance', 'Checked in');
    } catch (e) {
      attendanceMessage.value = userFriendlyError(e);
      Get.snackbar('Check-in', attendanceMessage.value);
    } finally {
      attendanceBusy.value = false;
    }
  }

  Future<void> checkOutNow() async {
    if (_auth.role.value != AppRoles.salesExecutive) return;
    attendanceBusy.value = true;
    attendanceMessage.value = '';
    try {
      final res = Map<String, dynamic>.from(
        await _auth.authorizedRequest(method: 'POST', path: '/hr/me/attendance/check-out') as Map,
      );
      final att = Map<String, dynamic>.from(res['attendance'] as Map);
      attendanceCheckIn.value = _fmtTime(att['check_in']);
      attendanceCheckOut.value = _fmtTime(att['check_out']);
      Get.snackbar('Attendance', 'Checked out');
    } catch (e) {
      attendanceMessage.value = userFriendlyError(e);
      Get.snackbar('Check-out', attendanceMessage.value);
    } finally {
      attendanceBusy.value = false;
    }
  }
}
