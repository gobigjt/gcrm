import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'sales_line_draft.dart';

class InvoiceFormController extends GetxController {
  InvoiceFormController({this.initialCustomerId, this.invoiceId});

  /// Pre-select customer (e.g. filtered Sales FAB / CRM handoff).
  final int? initialCustomerId;

  /// When set, load and PATCH this invoice (line items replaced on save).
  final int? invoiceId;

  bool get isEdit => invoiceId != null && invoiceId! > 0;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading    = false.obs;
  final isSaving     = false.obs;
  final errorMessage = ''.obs;

  final customers = <Map<String, dynamic>>[].obs;
  final products  = <Map<String, dynamic>>[].obs;

  final selectedCustomerId = Rxn<int>();
  late final TextEditingController invoiceDateCtrl;
  late final TextEditingController dueDateCtrl;
  final notesCtrl       = TextEditingController();
  final referenceNoCtrl = TextEditingController();

  // GST & tax type (replaces old isInterstate bool)
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

  bool get isInterstate => gstTypeValue.value == 'inter_state';

  @override
  void onInit() {
    super.onInit();
    final today = toYmd(DateTime.now());
    invoiceDateCtrl = TextEditingController(text: today);
    dueDateCtrl     = TextEditingController(text: today);
    _bootstrap();
  }

  @override
  void onClose() {
    for (final L in lines) { L.dispose(); }
    lines.clear();
    invoiceDateCtrl.dispose();
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
      await Future.wait([_loadCustomers(), _loadProducts()]);
      if (isEdit) {
        await _loadExistingInvoice();
      } else if (lines.isEmpty) {
        addLine();
      }
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
      final list = _extractProducts(res);
      products.assignAll(list);
    } catch (_) {
      products.clear();
    }
  }

  String _ymdFromApi(dynamic v) {
    final s = formatIsoDate(v);
    if (s == '—') return toYmd(DateTime.now());
    return s.length >= 10 ? s.substring(0, 10) : s;
  }

  Future<void> _loadExistingInvoice() async {
    final id  = invoiceId!;
    final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/invoices/$id');
    final inv = Map<String, dynamic>.from((res as Map)['invoice'] as Map);

    selectedCustomerId.value = (inv['customer_id'] as num?)?.toInt();
    invoiceDateCtrl.text     = _ymdFromApi(inv['invoice_date']);
    dueDateCtrl.text         = _ymdFromApi(inv['due_date']);
    notesCtrl.text           = (inv['notes'] ?? '').toString();
    referenceNoCtrl.text     = (inv['reference_no'] ?? '').toString();

    // GST & tax type
    final hasIgst = parseDynamicNum(inv['igst']) > 0;
    gstTypeValue.value  = hasIgst ? 'inter_state' : (inv['gst_type'] ?? 'intra_state').toString();
    taxTypeValue.value  = (inv['tax_type'] ?? 'exclusive').toString();

    // Extra charges
    discountAmountCtrl.text = parseDynamicNum(inv['discount_amount']).toString();
    shippingAmountCtrl.text = parseDynamicNum(inv['shipping_amount']).toString();
    extraDiscountCtrl.text  = parseDynamicNum(inv['extra_discount']).toString();
    roundOffCtrl.text       = parseDynamicNum(inv['round_off']).toString();

    // Payment
    paymentTermsValue.value  = (inv['payment_terms'] ?? '').toString();
    paymentMethodValue.value = (inv['payment_method'] ?? '').toString();

    for (final L in lines) { L.dispose(); }
    lines.clear();
    final rawItems = inv['items'];
    if (rawItems is List && rawItems.isNotEmpty) {
      for (final e in rawItems) {
        lines.add(SalesLineDraft.fromApiRow(Map<String, dynamic>.from(e as Map)));
      }
    } else {
      addLine();
    }
    lines.refresh();
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
    final interstate = isInterstate;
    final tt         = taxTypeValue.value;
    final payloadLines = lines
        .map((e) => e.toInvoiceLinePayload(interstate: interstate, taxType: tt))
        .where((p) => (p['quantity'] as num) != 0)
        .toList();
    if (payloadLines.isEmpty) {
      Get.snackbar('Lines', 'Add at least one line item.');
      return;
    }

    isSaving.value = true;
    try {
      final inv = invoiceDateCtrl.text.trim();
      final due = dueDateCtrl.text.trim();
      final ref = referenceNoCtrl.text.trim();
      final body = <String, dynamic>{
        'customer_id':     cid,
        'invoice_date':    inv.isEmpty ? null : inv,
        'due_date':        due.isEmpty ? null : due,
        'notes':           notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        'reference_no':    ref.isEmpty ? null : ref,
        'is_interstate':   interstate,
        'gst_type':        gstTypeValue.value,
        'tax_type':        taxTypeValue.value,
        'discount_amount': double.tryParse(discountAmountCtrl.text) ?? 0,
        'shipping_amount': double.tryParse(shippingAmountCtrl.text) ?? 0,
        'extra_discount':  double.tryParse(extraDiscountCtrl.text)  ?? 0,
        'round_off':       double.tryParse(roundOffCtrl.text)       ?? 0,
        'payment_terms':   paymentTermsValue.value.isEmpty  ? null : paymentTermsValue.value,
        'payment_method':  paymentMethodValue.value.isEmpty ? null : paymentMethodValue.value,
        'items':           payloadLines,
      };
      if (isEdit) {
        await _auth.authorizedRequest(
          method: 'PATCH',
          path: '/sales/invoices/${invoiceId!}',
          body: body,
        );
      } else {
        await _auth.authorizedRequest(method: 'POST', path: '/sales/invoices', body: body);
      }
      Get.back(result: true);
    } catch (e) {
      Get.snackbar('Save failed', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }
}
