import 'package:get/get.dart';

import '../../core/models/users_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class UsersController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final errorMessage = ''.obs;

  final users = <AdminUserRow>[].obs;
  final roles = <RoleOption>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadUsers(), loadRoles()]);
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadUsers() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/users');
    users.assignAll(
      (res as List).map((e) => AdminUserRow.fromJson(Map<String, dynamic>.from(e as Map))),
    );
  }

  Future<void> loadRoles() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/users/roles');
    roles.assignAll(
      (res as List)
          .map((e) => RoleOption.fromJson(Map<String, dynamic>.from(e as Map)))
          .where((r) => r.name.toLowerCase() != 'super admin'),
    );
  }

  Future<void> createUser({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/users',
        body: {
          'name': name,
          'email': email,
          'password': password,
          'role': role,
        },
      );
      await loadUsers();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> toggleStatus(int userId) async {
    await _auth.authorizedRequest(method: 'PATCH', path: '/users/$userId/toggle-status');
    await loadUsers();
  }
}
