import 'package:get/get.dart';

import '../../core/models/production_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class ProductionController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final workOrderStatusFilter = ''.obs;

  final boms = <BomListItem>[].obs;
  final workOrders = <WorkOrderRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadBoms(), loadWorkOrders()]);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadBoms() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/production/boms');
      boms.assignAll(
        (res as List).map((e) => BomListItem.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadWorkOrders() async {
    errorMessage.value = '';
    try {
      final status = workOrderStatusFilter.value.trim();
      final path = status.isEmpty ? '/production/work-orders' : '/production/work-orders?status=$status';
      final res = await _auth.authorizedRequest(method: 'GET', path: path);
      workOrders.assignAll(
        (res as List).map((e) => WorkOrderRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> createBom({
    required int productId,
    required String name,
    String? version,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/production/boms',
        body: {
          'product_id': productId,
          'name': name,
          'version': (version ?? '').trim().isEmpty ? '1.0' : version!.trim(),
          'items': <Map<String, dynamic>>[],
        },
      );
      await loadBoms();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> createWorkOrder({
    required int productId,
    int? bomId,
    required num quantity,
    String? plannedStart,
    String? plannedEnd,
    String? notes,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/production/work-orders',
        body: {
          'product_id': productId,
          'bom_id': bomId,
          'quantity': quantity,
          'planned_start': plannedStart,
          'planned_end': plannedEnd,
          'notes': notes,
        },
      );
      await loadWorkOrders();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> updateWorkOrderStatus({
    required int workOrderId,
    required String status,
  }) async {
    await _auth.authorizedRequest(
      method: 'PATCH',
      path: '/production/work-orders/$workOrderId',
      body: {'status': status},
    );
    await loadWorkOrders();
  }
}
