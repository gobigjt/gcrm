import 'package:get/get.dart';

import '../../core/models/settings_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class SettingsController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final errorMessage = ''.obs;

  final company = Rxn<CompanyProfile>();
  final modules = <ModuleSettingRow>[].obs;

  bool get isAdminOrSuper => _auth.role.value == 'Admin' || _auth.role.value == 'Super Admin';

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final c = await _auth.authorizedRequest(method: 'GET', path: '/settings/company');
      final m = await _auth.authorizedRequest(method: 'GET', path: '/settings/modules');
      company.value = c == null
          ? CompanyProfile.empty
          : CompanyProfile.fromJson(Map<String, dynamic>.from(c as Map));
      modules.assignAll(
        (m as List).map((e) => ModuleSettingRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> updateCompany({
    required String companyName,
    String? gstin,
    String? address,
    String? phone,
    String? email,
    String? currency,
    String? fiscalYearStart,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/settings/company',
        body: {
          'company_name': companyName,
          'gstin': (gstin ?? '').trim().isEmpty ? null : gstin!.trim(),
          'address': (address ?? '').trim().isEmpty ? null : address!.trim(),
          'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
          'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
          'currency': (currency ?? '').trim().isEmpty ? 'INR' : currency!.trim(),
          'fiscal_year_start': (fiscalYearStart ?? '').trim().isEmpty ? null : fiscalYearStart!.trim(),
        },
      );
      await loadAll();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> toggleModule({
    required String moduleKey,
    required bool isEnabled,
    required List<dynamic> allowedRoles,
  }) async {
    await _auth.authorizedRequest(
      method: 'PATCH',
      path: '/settings/modules/$moduleKey',
      body: {'is_enabled': isEnabled, 'allowed_roles': allowedRoles},
    );
    await loadAll();
  }
}
