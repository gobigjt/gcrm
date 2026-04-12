import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/product_catalog.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'sales_line_draft.dart';

class OrderFormController extends GetxController {
  OrderFormController({this.initialCustomerId});

  /// Pre-select customer (e.g. filtered Sales FAB / CRM handoff).
  final int? initialCustomerId;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading    = false.obs;
  final isSaving     = false.obs;
  final errorMessage = ''.obs;

  final customers = <Map<String, dynamic>>[].obs;
  final products  = <Map<String, dynamic>>[].obs;
  final executives = <Map<String, dynamic>>[].obs;

  final selectedCustomerId = Rxn<int>();
  final selectedCreatedById = Rxn<int>();
  late final TextEditingController orderDateCtrl;
  late final TextEditingController dueDateCtrl;
  final notesCtrl       = TextEditingController();
  final referenceNoCtrl = TextEditingController();

  // GST & tax type
  final gstTypeValue = 'intra_state'.obs; // 'intra_state' | 'inter_state'
  final taxTypeValue = 'exclusive'.obs;   // 'exclusive' | 'inclusive' | 'no_tax'

  // Extra charges
  final discountAmountCtrl = TextEditingController(text: '0');
  final shippingAmountCtrl = TextEditingController(text: '0');
  final extraDiscountCtrl  = TextEditingController(text: '0');
  final roundOffCtrl       = TextEditingController(text: '0');

  // Payment
  final paymentTermsValue  = ''.obs;
  final paymentMethodValue = ''.obs;

  final lines = <SalesLineDraft>[].obs;

  /// Matches web `SALES_ORDER_STATUS_LIST` default for new orders.
  final orderStatusValue = 'pending'.obs;

  bool get isInterstate => gstTypeValue.value == 'inter_state';

  @override
  void onInit() {
    super.onInit();
    final today = toYmd(DateTime.now());
    orderDateCtrl = TextEditingController(text: today);
    dueDateCtrl   = TextEditingController(text: today);
    _bootstrap();
  }

  @override
  void onClose() {
    for (final L in lines) { L.dispose(); }
    lines.clear();
    orderDateCtrl.dispose();
    dueDateCtrl.dispose();
    notesCtrl.dispose();
    referenceNoCtrl.dispose();
    discountAmountCtrl.dispose();
    shippingAmountCtrl.dispose();
    extraDiscountCtrl.dispose();
    roundOffCtrl.dispose();
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
      await Future.wait([_loadCustomers(), _loadProducts(), _loadExecutives()]);
      _syncCreatedBySelection();
      if (lines.isEmpty) addLine();
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> _loadCustomers() async {
    final res  = await _auth.authorizedRequest(method: 'GET', path: '/sales/customers');
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
      final res  = await _auth.authorizedRequest(method: 'GET', path: '/inventory/products');
      final list = productsWithAvailableStock(_extractProducts(res));
      products.assignAll(list);
    } catch (_) {
      products.clear();
    }
  }

  Future<void> _loadExecutives() async {
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/executives');
      executives.assignAll(_extractExecutives(res));
    } catch (_) {
      executives.clear();
    }
  }

  void _syncCreatedBySelection([int? preferred]) {
    final uid = _auth.userId.value > 0 ? _auth.userId.value : null;
    final p = preferred ?? selectedCreatedById.value ?? uid;
    final ids = executives.map((e) => (e['id'] as num).toInt()).toSet();
    if (p != null && ids.contains(p)) {
      selectedCreatedById.value = p;
    } else if (executives.isNotEmpty) {
      selectedCreatedById.value = (executives.first['id'] as num).toInt();
    }
  }

  static List<Map<String, dynamic>> _asList(dynamic res) {
    if (res is List) return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return [];
  }

  static List<Map<String, dynamic>> _extractProducts(dynamic res) {
    if (res is Map && res['products'] is List) {
      return (res['products'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    if (res is List) return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return [];
  }

  static List<Map<String, dynamic>> _extractExecutives(dynamic res) {
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
    line.productId     = (product['id'] as num?)?.toInt();
    line.descCtrl.text = (product['name'] ?? '').toString();
    line.unitCtrl.text = parseDynamicNum(product['sale_price']).toString();
    line.gstCtrl.text  = parseDynamicNum(product['gst_rate']).toString();
    lines.refresh();
  }

  Future<void> submit() async {
    final cid = selectedCustomerId.value;
    if (cid == null) {
      Get.snackbar('Missing customer', 'Select a customer.');
      return;
    }
    if (selectedCreatedById.value == null) {
      Get.snackbar('Sales executive', 'Select the sales executive for this document.');
      return;
    }
    final interstate = isInterstate;
    final tt = taxTypeValue.value;
    final payloadLines = lines
        .map((e) => e.toPayload(taxType: tt, interstate: interstate))
        .where((p) => (p['quantity'] as num) != 0)
        .toList();
    if (payloadLines.isEmpty) {
      Get.snackbar('Lines', 'Add at least one line item.');
      return;
    }

    isSaving.value = true;
    try {
      final od  = orderDateCtrl.text.trim();
      final due = dueDateCtrl.text.trim();
      final ref = referenceNoCtrl.text.trim();
      final body = <String, dynamic>{
        'customer_id':     cid,
        'order_date':      od.isEmpty  ? null : od,
        'due_date':        due.isEmpty ? null : due,
        'notes':           notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        'reference_no':    ref.isEmpty ? null : ref,
        'status':          orderStatusValue.value,
        'gst_type':        gstTypeValue.value,
        'tax_type':        taxTypeValue.value,
        'is_interstate':   interstate,
        'created_by':      selectedCreatedById.value,
        'discount_amount': double.tryParse(discountAmountCtrl.text) ?? 0,
        'shipping_amount': double.tryParse(shippingAmountCtrl.text) ?? 0,
        'extra_discount':  double.tryParse(extraDiscountCtrl.text)  ?? 0,
        'round_off':       double.tryParse(roundOffCtrl.text)       ?? 0,
        'payment_terms':   paymentTermsValue.value.isEmpty  ? null : paymentTermsValue.value,
        'payment_method':  paymentMethodValue.value.isEmpty ? null : paymentMethodValue.value,
        'items':           payloadLines,
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
