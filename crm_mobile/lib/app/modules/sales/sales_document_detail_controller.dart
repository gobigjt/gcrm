import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart' show parseDynamicNum;
import '../auth/auth_controller.dart';
import 'sales_document_kind.dart';

class SalesDocumentDetailController extends GetxController {
  SalesDocumentDetailController({required this.kind, required this.documentId});

  final SalesDocumentKind kind;
  final int documentId;

  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSaving = false.obs;
  final errorMessage = ''.obs;
  final document = Rxn<Map<String, dynamic>>();

  String get _path {
    switch (kind) {
      case SalesDocumentKind.quotation:
        return '/sales/quotations/$documentId';
      case SalesDocumentKind.order:
        return '/sales/orders/$documentId';
      case SalesDocumentKind.invoice:
        return '/sales/invoices/$documentId';
    }
  }

  String get _responseKey {
    switch (kind) {
      case SalesDocumentKind.quotation:
        return 'quotation';
      case SalesDocumentKind.order:
        return 'order';
      case SalesDocumentKind.invoice:
        return 'invoice';
    }
  }

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    if (documentId <= 0) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: _path);
      final root = res as Map;
      final raw = root[_responseKey];
      if (raw is! Map) {
        throw StateError('Invalid response');
      }
      document.value = Map<String, dynamic>.from(raw);
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
      document.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> setQuotationStatus(String status) async {
    if (kind != SalesDocumentKind.quotation || documentId <= 0) return;
    isSaving.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: _path,
        body: {'status': status},
      );
      await load();
    } catch (e) {
      Get.snackbar('Error', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> setOrderStatus(String status) async {
    if (kind != SalesDocumentKind.order || documentId <= 0) return;
    isSaving.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: _path,
        body: {'status': status},
      );
      await load();
    } catch (e) {
      Get.snackbar('Error', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }

  static List<Map<String, dynamic>> itemsOf(Map<String, dynamic>? d) {
    if (d == null) return [];
    final raw = d['items'];
    if (raw is! List) return [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static String customerName(Map<String, dynamic>? d) => (d?['customer_name'] ?? '—').toString();

  static String statusOf(Map<String, dynamic>? d, SalesDocumentKind kind) {
    return (d?['status'] ?? switch (kind) {
      SalesDocumentKind.quotation => 'draft',
      SalesDocumentKind.order => 'pending',
      SalesDocumentKind.invoice => 'unpaid',
    })
        .toString();
  }

  static double lineAmount(Map<String, dynamic> item) => parseDynamicNum(item['total']).toDouble();

  static double sumPayments(Map<String, dynamic>? inv) {
    if (inv == null) return 0;
    final pays = inv['payments'];
    if (pays is! List) return 0;
    var s = 0.0;
    for (final p in pays) {
      if (p is Map) {
        s += parseDynamicNum(p['amount']).toDouble();
      }
    }
    return s;
  }

  static double taxableFromItems(List<Map<String, dynamic>> items) {
    var t = 0.0;
    for (final it in items) {
      t += parseDynamicNum(it['quantity']).toDouble() * parseDynamicNum(it['unit_price']).toDouble();
    }
    return double.parse(t.toStringAsFixed(2));
  }

  static double gstFromItems(List<Map<String, dynamic>> items) {
    var g = 0.0;
    for (final it in items) {
      final base = parseDynamicNum(it['quantity']).toDouble() * parseDynamicNum(it['unit_price']).toDouble();
      final tot = parseDynamicNum(it['total']).toDouble();
      g += (tot - base).clamp(0.0, double.infinity);
    }
    return double.parse(g.toStringAsFixed(2));
  }
}
