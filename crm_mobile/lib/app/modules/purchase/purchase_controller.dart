import 'package:get/get.dart';

import '../../core/models/purchase_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class PurchaseController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final search = ''.obs;

  final vendors = <PurchaseVendor>[].obs;
  final pos = <PurchaseOrderRow>[].obs;
  final grns = <GrnRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadVendors(), loadPOs(), loadGRNs()]);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadVendors() async {
    errorMessage.value = '';
    try {
      final q = search.value.trim();
      final path = q.isEmpty ? '/purchase/vendors' : '/purchase/vendors?search=$q';
      final res = await _auth.authorizedRequest(method: 'GET', path: path);
      vendors.assignAll(
        (res as List).map((e) => PurchaseVendor.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadPOs() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/purchase/pos');
      pos.assignAll(
        (res as List).map((e) => PurchaseOrderRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadGRNs() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/purchase/grns');
      grns.assignAll(
        (res as List).map((e) => GrnRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> createVendor({
    required String name,
    String? email,
    String? phone,
    String? gstin,
    String? address,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/purchase/vendors',
        body: {
          'name': name,
          'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
          'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
          'gstin': (gstin ?? '').trim().isEmpty ? null : gstin!.trim(),
          'address': (address ?? '').trim().isEmpty ? null : address!.trim(),
        },
      );
      await loadVendors();
    } finally {
      isSubmitting.value = false;
    }
  }
}
