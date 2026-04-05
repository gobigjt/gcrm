import 'package:get/get.dart';

import '../auth/auth_controller.dart';

class InventoryController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final tabIndex = 0.obs;
  final products = <Map<String, dynamic>>[].obs;
  final warehouses = <Map<String, dynamic>>[].obs;
  final loading = false.obs;
  final errorMessage = RxnString();

  bool get isProductsTab => tabIndex.value == 0;

  @override
  void onInit() {
    super.onInit();
    _applyInitialTabFromArgs();
    load();
  }

  void _applyInitialTabFromArgs() {
    final a = Get.arguments;
    if (a is! Map) return;
    final t = a['initialTab'];
    if (t == 1 || t == 'warehouses') tabIndex.value = 1;
    if (t == 0 || t == 'products') tabIndex.value = 0;
  }

  void selectTab(int i) {
    tabIndex.value = i;
    load();
  }

  Future<void> load() async {
    loading.value = true;
    errorMessage.value = null;
    try {
      if (isProductsTab) {
        final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/products');
        products.assignAll(_extractList(res, key: 'products'));
      } else {
        final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/warehouses');
        warehouses.assignAll(_extractList(res, key: 'warehouses'));
      }
    } catch (e) {
      errorMessage.value = e.toString();
      if (isProductsTab) {
        products.clear();
      } else {
        warehouses.clear();
      }
    } finally {
      loading.value = false;
    }
  }

  static List<Map<String, dynamic>> _extractList(dynamic res, {String? key}) {
    if (key != null && res is Map && res[key] is List) {
      return (res[key] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    if (res is List) {
      return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    if (res is Map && res['data'] is List) {
      return (res['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }
}
