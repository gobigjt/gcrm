import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'sales_line_draft.dart';

class OrderFormController extends GetxController {
  OrderFormController({this.initialCustomerId});

  /// Pre-select customer (e.g. filtered Sales FAB / CRM handoff).
  final int? initialCustomerId;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSaving = false.obs;
  final errorMessage = ''.obs;

  final customers = <Map<String, dynamic>>[].obs;
  final products = <Map<String, dynamic>>[].obs;

  final selectedCustomerId = Rxn<int>();
  late final TextEditingController orderDateCtrl;
  final notesCtrl = TextEditingController();
  final lines = <SalesLineDraft>[].obs;

  @override
  void onInit() {
    super.onInit();
    orderDateCtrl = TextEditingController(text: toYmd(DateTime.now()));
    _bootstrap();
  }

  @override
  void onClose() {
    for (final L in lines) {
      L.dispose();
    }
    lines.clear();
    orderDateCtrl.dispose();
    notesCtrl.dispose();
    super.onClose();
  }

  Future<void> retry() async {
    errorMessage.value = '';
    await _bootstrap();
  }

  Future<void> _bootstrap() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([_loadCustomers(), _loadProducts()]);
      if (lines.isEmpty) addLine();
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> _loadCustomers() async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/customers');
    final list = _asList(res);
    customers.assignAll(list);
    final init = initialCustomerId;
    if (init != null && list.any((c) => (c['id'] as num?)?.toInt() == init)) {
      selectedCustomerId.value = init;
      return;
    }
    if (selectedCustomerId.value == null && list.isNotEmpty) {
      final id = list.first['id'];
      if (id != null) selectedCustomerId.value = (id as num).toInt();
    }
  }

  Future<void> _loadProducts() async {
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/inventory/products');
      final list = _extractProducts(res);
      products.assignAll(list);
    } catch (_) {
      products.clear();
    }
  }

  static List<Map<String, dynamic>> _asList(dynamic res) {
    if (res is List) {
      return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  static List<Map<String, dynamic>> _extractProducts(dynamic res) {
    if (res is Map && res['products'] is List) {
      return (res['products'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    if (res is List) {
      return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  void addLine() {
    lines.add(SalesLineDraft());
    lines.refresh();
  }

  void removeLineAt(int i) {
    if (i < 0 || i >= lines.length) return;
    lines[i].dispose();
    lines.removeAt(i);
    if (lines.isEmpty) addLine();
    lines.refresh();
  }

  void applyProductToLine(int lineIndex, Map<String, dynamic> product) {
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    final line = lines[lineIndex];
    line.productId = (product['id'] as num?)?.toInt();
    line.descCtrl.text = (product['name'] ?? '').toString();
    line.unitCtrl.text = parseDynamicNum(product['sale_price']).toString();
    line.gstCtrl.text = parseDynamicNum(product['gst_rate']).toString();
    lines.refresh();
  }

  Future<void> submit() async {
    final cid = selectedCustomerId.value;
    if (cid == null) {
      Get.snackbar('Missing customer', 'Select a customer.');
      return;
    }
    final payloadLines = lines.map((e) => e.toPayload()).where((p) => (p['quantity'] as num) != 0).toList();
    if (payloadLines.isEmpty) {
      Get.snackbar('Lines', 'Add at least one line item.');
      return;
    }

    isSaving.value = true;
    try {
      final od = orderDateCtrl.text.trim();
      final body = <String, dynamic>{
        'customer_id': cid,
        'order_date': od.isEmpty ? null : od,
        'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        'status': 'pending',
        'items': payloadLines,
      };
      await _auth.authorizedRequest(method: 'POST', path: '/sales/orders', body: body);
      Get.back(result: true);
    } catch (e) {
      Get.snackbar('Save failed', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }
}
