import 'package:get/get.dart';

import '../../core/models/inventory_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class InventoryController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final search = ''.obs;

  final products = <InventoryProduct>[].obs;
  final warehouses = <InventoryWarehouse>[].obs;
  final lowStock = <InventoryLowStockRow>[].obs;
  final movements = <StockMovementRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadProducts(), loadWarehouses(), loadLowStock(), loadMovements()]);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadProducts() async {
    errorMessage.value = '';
    try {
      final q = search.value.trim();
      final path = q.isEmpty ? '/inventory/products' : '/inventory/products?search=$q';
      final res = await _auth.authorizedRequest(method: 'GET', path: path);
      products.assignAll(
        (res as List).map((e) => InventoryProduct.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadWarehouses() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/warehouses');
      warehouses.assignAll(
        (res as List).map((e) => InventoryWarehouse.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadLowStock() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/stock/low');
      lowStock.assignAll(
        (res as List).map((e) => InventoryLowStockRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadMovements() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/movements');
      movements.assignAll(
        (res as List).map((e) => StockMovementRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> createProduct({
    required String name,
    String? sku,
    String? hsnCode,
    String? unit,
    num? purchasePrice,
    num? salePrice,
    num? gstRate,
    num? lowStockAlert,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/inventory/products',
        body: {
          'name': name,
          'sku': (sku ?? '').trim().isEmpty ? null : sku!.trim(),
          'hsn_code': (hsnCode ?? '').trim().isEmpty ? null : hsnCode!.trim(),
          'unit': (unit ?? '').trim().isEmpty ? 'pcs' : unit!.trim(),
          'purchase_price': purchasePrice ?? 0,
          'sale_price': salePrice ?? 0,
          'gst_rate': gstRate ?? 0,
          'low_stock_alert': lowStockAlert ?? 0,
        },
      );
      await loadProducts();
      await loadLowStock();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> adjustStock({
    required int productId,
    required int warehouseId,
    required String type,
    required num quantity,
    String? note,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/inventory/stock/adjust',
        body: {
          'product_id': productId,
          'warehouse_id': warehouseId,
          'type': type,
          'quantity': quantity,
          'note': (note ?? '').trim().isEmpty ? null : note!.trim(),
        },
      );
      await Future.wait([loadLowStock(), loadMovements(), loadProducts()]);
    } finally {
      isSubmitting.value = false;
    }
  }
}
