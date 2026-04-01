import 'package:get/get.dart';

import '../../core/models/sales_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class SalesController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final search = ''.obs;

  final customers = <SalesCustomer>[].obs;
  final quotations = <SalesQuotation>[].obs;
  final orders = <SalesOrderRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadCustomers(), loadQuotations(), loadOrders()]);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadCustomers() async {
    errorMessage.value = '';
    try {
      final q = search.value.trim();
      final path = q.isEmpty ? '/sales/customers' : '/sales/customers?search=$q';
      final res = await _auth.authorizedRequest(method: 'GET', path: path);
      customers.assignAll(
        (res as List).map((e) => SalesCustomer.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadQuotations() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/quotations');
      quotations.assignAll(
        (res as List).map((e) => SalesQuotation.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadOrders() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/orders');
      orders.assignAll(
        (res as List).map((e) => SalesOrderRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> createCustomer({
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
        path: '/sales/customers',
        body: {
          'name': name,
          'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
          'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
          'gstin': (gstin ?? '').trim().isEmpty ? null : gstin!.trim(),
          'address': (address ?? '').trim().isEmpty ? null : address!.trim(),
        },
      );
      await loadCustomers();
    } finally {
      isSubmitting.value = false;
    }
  }
}
