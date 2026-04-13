import 'package:get/get.dart';

import '../../core/models/users_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class SalesTeamPayload {
  SalesTeamPayload({required this.assigned, required this.available});

  final List<AdminUserRow> assigned;
  final List<AdminUserRow> available;

  factory SalesTeamPayload.fromJson(Map<String, dynamic> json) {
    List<AdminUserRow> mapList(dynamic list) {
      if (list is! List) return [];
      return list
          .map((e) => AdminUserRow.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }

    return SalesTeamPayload(
      assigned: mapList(json['assigned']),
      available: mapList(json['available']),
    );
  }
}

class UsersController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final errorMessage = ''.obs;

  final users = <AdminUserRow>[].obs;
  final roles = <RoleOption>[].obs;
  final zones = <ZoneRow>[].obs;
  final salesManagers = <SalesManagerPick>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadUsers(), loadRoles(), loadZones(), loadSalesManagers()]);
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadUsers() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/users');
    users.assignAll(
      (res as List)
          .map((e) => AdminUserRow.fromJson(Map<String, dynamic>.from(e as Map)))
          .where((u) => !_isSuperAdminRole(u.role)),
    );
  }

  static bool _isSuperAdminRole(String role) {
    final n = role.toLowerCase().replaceAll(RegExp(r'[\s_-]+'), '');
    return n == 'superadmin';
  }

  Future<void> loadRoles() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/users/roles');
    roles.assignAll(
      (res as List)
          .map((e) => RoleOption.fromJson(Map<String, dynamic>.from(e as Map)))
          .where((r) => !_isSuperAdminRole(r.name)),
    );
  }

  Future<void> loadZones() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/users/zones');
    zones.assignAll(
      (res as List).map((e) => ZoneRow.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    );
  }

  Future<void> loadSalesManagers() async {
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/users/sales-managers');
      salesManagers.assignAll(
        (res as List)
            .map((e) => SalesManagerPick.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );
    } catch (_) {
      salesManagers.clear();
    }
  }

  Future<SalesTeamPayload> loadSalesTeam(int managerId) async {
    final data = await _auth.authorizedRequest(
      method: 'GET',
      path: '/users/managers/$managerId/sales-team',
    );
    return SalesTeamPayload.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> createUser({
    required String name,
    required String email,
    required String password,
    required String role,
    int? zoneId,
    int? salesManagerId,
  }) async {
    isSubmitting.value = true;
    try {
      final body = <String, dynamic>{
        'name': name,
        'email': email,
        'password': password,
        'role': role,
        'zone_id': zoneId,
      };
      if (isSalesExecutiveRole(role) && salesManagerId != null) {
        body['sales_manager_id'] = salesManagerId;
      }
      await _auth.authorizedRequest(method: 'POST', path: '/users', body: body);
      await loadUsers();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> updateUser({
    required int id,
    required String name,
    required String email,
    required String role,
    String? password,
    int? zoneId,
    int? salesManagerId,
  }) async {
    isSubmitting.value = true;
    try {
      final body = <String, dynamic>{
        'name': name,
        'email': email,
        'role': role,
        'zone_id': zoneId,
      };
      if (password != null && password.isNotEmpty) {
        body['password'] = password;
      }
      if (isSalesExecutiveRole(role)) {
        body['sales_manager_id'] = salesManagerId;
      }
      await _auth.authorizedRequest(method: 'PATCH', path: '/users/$id', body: body);
      await loadUsers();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> setExecutiveManager({required int executiveId, required int? managerId}) async {
    await _auth.authorizedRequest(
      method: 'PATCH',
      path: '/users/$executiveId',
      body: {'sales_manager_id': managerId},
    );
    await loadUsers();
  }

  Future<void> toggleStatus(int userId) async {
    await _auth.authorizedRequest(method: 'PATCH', path: '/users/$userId/toggle-status');
    await loadUsers();
  }

  // ─── Zones CRUD ──────────────────────────────────────────

  Future<void> createZone({required String name, String? code}) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/users/zones',
        body: {
          'name': name,
          'code': (code == null || code.trim().isEmpty) ? null : code.trim(),
        },
      );
      await loadZones();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> updateZone({required int id, required String name, String? code}) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/users/zones/$id',
        body: {
          'name': name,
          'code': (code == null || code.trim().isEmpty) ? null : code.trim(),
        },
      );
      await loadZones();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> deleteZone(int id) async {
    await _auth.authorizedRequest(method: 'DELETE', path: '/users/zones/$id');
    await loadZones();
  }
}
