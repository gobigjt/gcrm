import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';
import 'sales_line_draft.dart';

class QuotationFormController extends GetxController {
  QuotationFormController({
    this.quotationId,
    this.copyFromId,
    this.initialCustomerId,
    this.initialCreatedById,
    this.forceCustomerPrefill = false,
  });

  /// Edit existing quotation.
  final int? quotationId;

  /// Pre-fill from this id then create new (POST).
  final int? copyFromId;

  /// New quotation: pre-select customer (e.g. CRM lead handoff).
  final int? initialCustomerId;
  final int? initialCreatedById;
  final bool forceCustomerPrefill;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading  = false.obs;
  final isSaving   = false.obs;
  final errorMessage = ''.obs;

  final customers = <Map<String, dynamic>>[].obs;
  final products  = <Map<String, dynamic>>[].obs;
  final executives = <Map<String, dynamic>>[].obs;

  final selectedCustomerId = Rxn<int>();
  final selectedCreatedById = Rxn<int>();
  final validUntilCtrl     = TextEditingController();
  final notesCtrl          = TextEditingController();
  final customerBillingAddressCtrl = TextEditingController();
  final customerShippingAddressCtrl = TextEditingController();

  // GST & tax type
  final gstTypeValue  = 'intra_state'.obs; // 'intra_state' | 'inter_state'
  final taxTypeValue  = 'exclusive'.obs;   // 'exclusive' | 'inclusive' | 'no_tax'

  /// Placeholders for [salesTotalsCard] (web quote totals are line-only).
  final discountAmountCtrl  = TextEditingController(text: '0');
  final shippingAmountCtrl  = TextEditingController(text: '0');
  final roundOffCtrl        = TextEditingController(text: '0');

  final lines       = <SalesLineDraft>[].obs;

  /// Preserved when editing (PATCH); new quotations stay `draft`.
  final statusValue = 'draft'.obs;

  bool get isEdit => quotationId != null && quotationId! > 0;
  bool get isInterstate => gstTypeValue.value == 'inter_state';

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
    customerBillingAddressCtrl.dispose();
    customerShippingAddressCtrl.dispose();
    discountAmountCtrl.dispose();
    shippingAmountCtrl.dispose();
    roundOffCtrl.dispose();
    super.onClose();
  }

  void _disposeAllLines() {
    for (final L in lines) { L.dispose(); }
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
      await Future.wait([_loadCustomers(), _loadProducts(), _loadExecutives()]);
      final sourceId = quotationId ?? copyFromId;
      if (sourceId != null && sourceId > 0) {
        await _loadQuotationIntoForm(sourceId);
        if (copyFromId != null && quotationId == null) {
          statusValue.value = 'draft';
        }
      } else {
        // For new quotations, always resolve to a valid executive.
        // Sales Executives cannot edit this field, so default to logged-in user.
        if (initialCreatedById != null && initialCreatedById! > 0) {
          _syncCreatedBySelection(initialCreatedById);
        } else {
          _syncCreatedBySelection();
        }
        if (lines.isEmpty) addLine();
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
    final sourceMode = quotationId != null || copyFromId != null;
    if (sourceMode) return;
    // New quotations should not pre-select customer unless explicitly requested.
    if (forceCustomerPrefill && initialCustomerId != null) {
      final ids = list.map((c) => (c['id'] as num?)?.toInt()).whereType<int>().toSet();
      selectedCustomerId.value = ids.contains(initialCustomerId) ? initialCustomerId : null;
      onCustomerChanged(selectedCustomerId.value, forceAddressRefresh: true);
      return;
    }
    selectedCustomerId.value = null;
    customerBillingAddressCtrl.clear();
    customerShippingAddressCtrl.clear();
  }

  Future<void> _loadProducts() async {
    try {
      final res  = await _auth.authorizedRequest(method: 'GET', path: '/inventory/products');
      products.assignAll(_extractProducts(res));
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

  Map<String, dynamic>? _customerById(int? id) {
    if (id == null) return null;
    for (final cu in customers) {
      if ((cu['id'] as num?)?.toInt() == id) return cu;
    }
    return null;
  }

  void onCustomerChanged(int? customerId, {bool forceAddressRefresh = false}) {
    selectedCustomerId.value = customerId;
    if (customerId == null) {
      customerBillingAddressCtrl.clear();
      customerShippingAddressCtrl.clear();
      return;
    }
    if (!forceAddressRefresh &&
        customerBillingAddressCtrl.text.trim().isNotEmpty &&
        customerShippingAddressCtrl.text.trim().isNotEmpty) {
      return;
    }
    final cu = _customerById(customerId);
    customerBillingAddressCtrl.text = (cu?['billing_address'] ?? '').toString();
    customerShippingAddressCtrl.text = (cu?['shipping_address'] ?? '').toString();
  }

  Future<void> _loadQuotationIntoForm(int id) async {
    final res = await _auth.authorizedRequest(method: 'GET', path: '/sales/quotations/$id');
    final q   = Map<String, dynamic>.from((res as Map)['quotation'] as Map);

    selectedCustomerId.value = (q['customer_id'] as num?)?.toInt();
    validUntilCtrl.text      = formatIsoDate(q['valid_until']);
    if (validUntilCtrl.text == '—') validUntilCtrl.clear();
    notesCtrl.text       = (q['notes'] ?? '').toString();
    statusValue.value    = (q['status'] ?? 'draft').toString();
    customerBillingAddressCtrl.text = (q['customer_billing_address'] ?? q['customer_address'] ?? '').toString();
    customerShippingAddressCtrl.text = (q['customer_shipping_address'] ?? '').toString();
    selectedCreatedById.value =
        (q['sales_executive_id'] as num?)?.toInt() ?? (q['created_by'] as num?)?.toInt();
    _syncCreatedBySelection(selectedCreatedById.value);

    // GST & tax type
    final hasIgst = parseDynamicNum(q['igst']) > 0;
    gstTypeValue.value  = hasIgst ? 'inter_state' : (q['gst_type'] ?? 'intra_state').toString();
    taxTypeValue.value  = (q['tax_type'] ?? 'exclusive').toString();

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
    line.productId      = (product['id'] as num?)?.toInt();
    line.descCtrl.text  = (product['name'] ?? '').toString();
    line.unitCtrl.text  = parseDynamicNum(product['sale_price']).toString();
    line.gstCtrl.text   = parseDynamicNum(product['gst_rate']).toString();
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
        .where((p) => p['quantity'] != 0)
        .toList();
    if (payloadLines.isEmpty) {
      Get.snackbar('Lines', 'Add at least one line item.');
      return;
    }

    isSaving.value = true;
    try {
      final vu  = validUntilCtrl.text.trim();
      // Matches web `Sales.jsx` DocumentModal quote POST/PATCH body.
      final body = <String, dynamic>{
        'customer_id':      cid,
        'valid_until':      vu.isEmpty ? null : vu,
        'notes':            notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
        'status':           isEdit ? statusValue.value : 'draft',
        'gst_type':         gstTypeValue.value,
        'tax_type':         taxTypeValue.value,
        'is_interstate':    interstate,
        'customer_billing_address':
            customerBillingAddressCtrl.text.trim().isEmpty ? null : customerBillingAddressCtrl.text.trim(),
        'customer_shipping_address':
            customerShippingAddressCtrl.text.trim().isEmpty ? null : customerShippingAddressCtrl.text.trim(),
        'sales_executive_id': selectedCreatedById.value,
        'items':            payloadLines,
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
