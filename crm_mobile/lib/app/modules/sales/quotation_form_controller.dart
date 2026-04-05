import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'sales_line_draft.dart';

class QuotationFormController extends GetxController {
  QuotationFormController({this.quotationId, this.copyFromId, this.initialCustomerId});

  /// Edit existing quotation.
  final int? quotationId;

  /// Pre-fill from this id then create new (POST).
  final int? copyFromId;

  /// New quotation: pre-select customer (e.g. CRM lead handoff).
  final int? initialCustomerId;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSaving = false.obs;
  final errorMessage = ''.obs;

  final customers = <Map<String, dynamic>>[].obs;
  final products = <Map<String, dynamic>>[].obs;

  final selectedCustomerId = Rxn<int>();
  final validUntilCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  final lines = <SalesLineDraft>[].obs;

  /// Preserved when editing (PATCH); new quotations stay `draft`.
  final statusValue = 'draft'.obs;

  bool get isEdit => quotationId != null && quotationId! > 0;

  @override
  void onInit() {
    super.onInit();
    _bootstrap();
  }

  @override
  void onClose() {
    _disposeAllLines();
    validUntilCtrl.dispose();
    notesCtrl.dispose();
    super.onClose();
  }

  void _disposeAllLines() {
    for (final L in lines) {
      L.dispose();
    }
    lines.clear();
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
      final sourceId = quotationId ?? copyFromId;
      if (sourceId != null && sourceId > 0) {
        await _loadQuotationIntoForm(sourceId);
        if (copyFromId != null && quotationId == null) {
          statusValue.value = 'draft';
        }
      } else {
        if (lines.isEmpty) addLine();
      }
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
    final skipDefaultCustomer = quotationId != null || copyFromId != null;
    if (!skipDefaultCustomer && selectedCustomerId.value == null && list.isNotEmpty) {
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

  Future<void> _loadQuotationIntoForm(int id) async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/quotations/$id');
    final q = Map<String, dynamic>.from((res as Map)['quotation'] as Map);
    selectedCustomerId.value = (q['customer_id'] as num?)?.toInt();
    validUntilCtrl.text = formatIsoDate(q['valid_until']);
    if (validUntilCtrl.text == '—') validUntilCtrl.clear();
    notesCtrl.text = (q['notes'] ?? '').toString();
    statusValue.value = (q['status'] ?? 'draft').toString();
    final rawItems = q['items'];
    _disposeAllLines();
    if (rawItems is List && rawItems.isNotEmpty) {
      for (final e in rawItems) {
        lines.add(SalesLineDraft.fromApiRow(Map<String, dynamic>.from(e as Map)));
      }
    } else {
      addLine();
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
    final payloadLines = lines.map((e) => e.toPayload()).where((p) => p['quantity'] != 0).toList();
    if (payloadLines.isEmpty) {
      Get.snackbar('Lines', 'Add at least one line item.');
      return;
    }

    isSaving.value = true;
    try {
      final vu = validUntilCtrl.text.trim();
      final body = <String, dynamic>{
        'customer_id': cid,
        'valid_until': vu.isEmpty ? null : vu,
        'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        'status': isEdit ? statusValue.value : 'draft',
        'items': payloadLines,
      };

      if (isEdit) {
        await _auth.authorizedRequest(
          method: 'PATCH',
          path: '/sales/quotations/$quotationId',
          body: body,
        );
      } else {
        await _auth.authorizedRequest(
          method: 'POST',
          path: '/sales/quotations',
          body: body,
        );
      }
      Get.back(result: true);
    } catch (e) {
      Get.snackbar('Save failed', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }
}
