import 'dart:async';

import 'package:flutter/scheduler.dart';
import 'package:get/get.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/network/error_utils.dart';
import '../../core/auth/role_permissions.dart';
import '../../core/storage/secure_storage_service.dart';
import '../../core/auth/role_home_route.dart';
import '../../routes/app_routes.dart';
import '../attendance/sales_attendance_controller.dart';

class AuthController extends GetxController {
  final ApiClient _api = ApiClient();
  final SecureStorageService _storage = SecureStorageService();
  Future<void>? _tokenRefreshInFlight;

  final email = ''.obs;
  final password = ''.obs;
  /// Login field: when true, password characters are hidden.
  final passwordObscured = true.obs;
  final isLoading = false.obs;
  final isBootstrapping = true.obs;
  final isLoggedIn = false.obs;
  final userName = 'Guest'.obs;
  final userEmail = ''.obs;
  final userId = 0.obs;
  final role = ''.obs;
  final grantedPermissions = <String>{}.obs;
  final accessToken = ''.obs;
  final refreshToken = ''.obs;

  bool get canSubmit => email.value.trim().isNotEmpty && password.value.length >= 6;

  @override
  void onInit() {
    super.onInit();
    restoreSession();
  }

  Future<void> login() async {
    if (!canSubmit) {
      Get.snackbar('Invalid input', 'Enter a valid email and password (min 6 chars).');
      return;
    }
    isLoading.value = true;
    try {
      final data = await _api.login(email: email.value.trim(), password: password.value);
      final user = Map<String, dynamic>.from(data['user'] as Map);
      final access = data['access_token'].toString();
      final refresh = data['refresh_token'].toString();
      await _storage.saveSession(accessToken: access, refreshToken: refresh, user: user);
      await _applySession(user: user, access: access, refresh: refresh);
      isLoggedIn.value = true;
      final home = resolveRoleHome(roleName: role.value, hasPermission: hasPermission);
      Get.offAllNamed(home);
      _showSalesExecutiveAttendanceAfterLogin();
    } catch (e) {
      Get.snackbar('Login failed', userFriendlyError(e, loginAttempt: true));
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> restoreSession() async {
    isBootstrapping.value = true;
    try {
      final storedAccess = await _storage.readAccessToken();
      final storedRefresh = await _storage.readRefreshToken();
      final storedUser = await _storage.readUser();
      if (storedAccess == null || storedRefresh == null || storedUser == null) {
        await _clearLocalSession();
        return;
      }

      try {
        final me = await _api.me(storedAccess);
        await _applySession(
          user: Map<String, dynamic>.from(me),
          access: storedAccess,
          refresh: storedRefresh,
        );
      } catch (_) {
        final refreshed = await _api.refresh(storedRefresh);
        final newAccess = refreshed['access_token'].toString();
        final newRefresh = refreshed['refresh_token'].toString();
        final me = await _api.me(newAccess);
        await _storage.saveSession(
          accessToken: newAccess,
          refreshToken: newRefresh,
          user: Map<String, dynamic>.from(me as Map),
        );
        await _applySession(
          user: Map<String, dynamic>.from(me),
          access: newAccess,
          refresh: newRefresh,
        );
      }
    } catch (_) {
      await _clearLocalSession();
    } finally {
      isBootstrapping.value = false;
    }
  }

  Future<void> logout() async {
    final access = accessToken.value;
    final refresh = refreshToken.value;
    if (access.isNotEmpty && refresh.isNotEmpty) {
      try {
        await _api.logout(accessToken: access, refreshToken: refresh);
      } catch (_) {}
    }
    await _clearLocalSession();
    Get.offAllNamed(AppRoutes.splash);
  }

  bool hasPermission(String permission) {
    if (role.value == AppRoles.superAdmin) return true;
    return grantedPermissions.contains(permission);
  }

  Future<dynamic> authorizedRequest({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final access = accessToken.value;
    if (access.isEmpty) {
      throw Exception('Not authenticated');
    }

    try {
      return await _api.request(
        method: method,
        path: path,
        body: body,
        headers: {'Authorization': 'Bearer $access'},
      );
    } catch (e) {
      final unauthorized = e is ApiException && e.statusCode == 401;
      if (!unauthorized) rethrow;

      try {
        await _ensureFreshTokens();
        return _api.request(
          method: method,
          path: path,
          body: body,
          headers: {'Authorization': 'Bearer ${accessToken.value}'},
        );
      } catch (_) {
        await _clearLocalSession();
        Get.offAllNamed(AppRoutes.login);
        throw Exception('Session expired. Please log in again.');
      }
    }
  }

  Future<void> _ensureFreshTokens() async {
    final inFlight = _tokenRefreshInFlight;
    if (inFlight != null) {
      await inFlight;
      return;
    }

    final refreshFuture = _refreshSessionTokens();
    _tokenRefreshInFlight = refreshFuture;
    try {
      await refreshFuture;
    } finally {
      _tokenRefreshInFlight = null;
    }
  }

  Future<void> _applySession({
    required Map<String, dynamic> user,
    required String access,
    required String refresh,
  }) async {
    userName.value = (user['name'] ?? 'User').toString();
    userEmail.value = (user['email'] ?? '').toString();
    userId.value = (user['id'] as num? ?? 0).toInt();
    role.value = (user['role'] ?? '').toString();
    accessToken.value = access;
    refreshToken.value = refresh;
    await _loadPermissionsFromServer(access);
    isLoggedIn.value = true;
    await refreshSalesExecutiveAttendance();
  }

  /// Loads today’s attendance for Sales Executive (any home route, not only dashboard).
  Future<void> refreshSalesExecutiveAttendance() async {
    if (role.value != AppRoles.salesExecutive) return;
    try {
      if (!Get.isRegistered<SalesAttendanceController>()) {
        Get.put(SalesAttendanceController());
      }
      await Get.find<SalesAttendanceController>().refreshTodayAttendance();
    } catch (_) {}
  }

  void _showSalesExecutiveAttendanceAfterLogin() {
    if (role.value != AppRoles.salesExecutive) return;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!Get.isRegistered<SalesAttendanceController>()) return;
      final c = Get.find<SalesAttendanceController>();
      if (c.attendanceMessage.value.isNotEmpty) {
        Get.snackbar('Attendance', c.attendanceMessage.value);
        return;
      }
      final inTime = c.attendanceCheckIn.value;
      final outTime = c.attendanceCheckOut.value;
      if (inTime != null && inTime.isNotEmpty) {
        final outPart =
            (outTime != null && outTime.isNotEmpty) ? ' · out $outTime' : '';
        Get.snackbar('Attendance', 'Checked in at $inTime$outPart');
      } else {
        Get.snackbar('Attendance', 'Not checked in yet — open the menu for Check-in / Attendance');
      }
    });
  }

  Future<void> _refreshSessionTokens() async {
    final currentRefresh = refreshToken.value;
    if (currentRefresh.isEmpty) {
      await _clearLocalSession();
      throw Exception('Session expired');
    }
    final refreshed = await _api.refresh(currentRefresh);
    final newAccess = refreshed['access_token'].toString();
    final newRefresh = refreshed['refresh_token'].toString();
    accessToken.value = newAccess;
    refreshToken.value = newRefresh;
    final user = await _storage.readUser() ?? <String, dynamic>{'name': userName.value, 'role': role.value};
    await _storage.saveSession(accessToken: newAccess, refreshToken: newRefresh, user: user);
  }

  Future<void> _loadPermissionsFromServer(String access) async {
    final modules = await _api.settingsModules(access);
    final can = <String>{AppPermissions.dashboard};
    for (final module in modules) {
      final item = Map<String, dynamic>.from(module as Map);
      final isEnabled = item['is_enabled'] == true;
      final allowedRoles = (item['allowed_roles'] as List<dynamic>? ?? const []).map((e) => e.toString()).toList();
      if (!isEnabled || !allowedRoles.contains(role.value)) continue;
      switch (item['module']) {
        case 'crm':
          can.add(AppPermissions.crm);
          break;
        case 'sales':
          can.add(AppPermissions.sales);
          break;
        case 'purchase':
          can.add(AppPermissions.purchase);
          break;
        case 'inventory':
          can.add(AppPermissions.inventory);
          break;
        case 'production':
          can.add(AppPermissions.production);
          break;
        case 'finance':
          can.add(AppPermissions.finance);
          break;
        case 'hr':
          can.add(AppPermissions.hr);
          break;
        case 'settings':
          can.add(AppPermissions.settings);
          break;
        case 'users':
          can.add(AppPermissions.users);
          break;
      }
    }
    grantedPermissions.assignAll(can);
  }

  Future<void> _clearLocalSession() async {
    isLoggedIn.value = false;
    password.value = '';
    role.value = '';
    userEmail.value = '';
    userId.value = 0;
    accessToken.value = '';
    refreshToken.value = '';
    grantedPermissions.clear();
    await _storage.clearSession();
  }
}
