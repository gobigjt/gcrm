import 'package:get/get.dart';

import '../../core/utils/ui_format.dart';
import '../auth/auth_controller.dart';

class SalesController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  /// 0 = quotations, 1 = invoices, 2 = orders, 3 = customers
  final tabIndex = 0.obs;
  final rows = <Map<String, dynamic>>[].obs;
  final loading = false.obs;
  final errorMessage = RxnString();

  /// Last known quotation list length (for tab badge when browsing other tabs).
  final quotationListCount = 0.obs;

  /// CRM handoff: show only this customer's quotations (quotes tab).
  final filterCustomerId = Rxn<int>();
  final filterCustomerName = RxnString();

  bool get isQuotationsTab => tabIndex.value == 0;
  bool get isInvoicesTab => tabIndex.value == 1;
  bool get isOrdersTab => tabIndex.value == 2;
  bool get isCustomersTab => tabIndex.value == 3;

  @override
  void onInit() {
    super.onInit();
    applyRouteArguments(Get.arguments);
    load();
  }

  /// Call when opening [SalesView] with `Get.arguments` (tab, optional customer filter).
  void applyRouteArguments(dynamic a) {
    if (a is! Map) {
      filterCustomerId.value = null;
      filterCustomerName.value = null;
      return;
    }
    final cidRaw = a['filterCustomerId'] ?? a['customerId'];
    if (cidRaw != null) {
      final cid = cidRaw is num ? cidRaw.toInt() : int.tryParse(cidRaw.toString());
      if (cid != null && cid > 0) {
        filterCustomerId.value = cid;
        final n = a['filterCustomerName']?.toString().trim();
        filterCustomerName.value = (n != null && n.isNotEmpty) ? n : null;
        tabIndex.value = 0;
        return;
      }
    }
    filterCustomerId.value = null;
    filterCustomerName.value = null;
    final t = a['initialTab'];
    if (t == 2 || t == 'orders') {
      tabIndex.value = 2;
      return;
    }
    if (t == 3 || t == 'customers') {
      tabIndex.value = 3;
      return;
    }
    if (t == 1 || t == 'invoices') {
      tabIndex.value = 1;
      return;
    }
    if (t == 0 || t == 'quotes' || t == 'quotations') {
      tabIndex.value = 0;
    }
  }

  void clearCustomerFilter() {
    filterCustomerId.value = null;
    filterCustomerName.value = null;
    load();
  }

  void selectTab(int i) {
    if (i < 0 || i > 3) return;
    tabIndex.value = i;
    load();
  }

  String get _listPath {
    switch (tabIndex.value) {
      case 1:
        return '/sales/invoices';
      case 2:
        return '/sales/orders';
      case 3:
        return '/sales/customers';
      case 0:
      default:
        return '/sales/quotations';
    }
  }

  Future<void> load() async {
    loading.value = true;
    errorMessage.value = null;
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: _listPath);
      var list = _asMapList(res);
      final fc = filterCustomerId.value;
      if (fc != null) {
        list = list.where((r) => (r['customer_id'] as num?)?.toInt() == fc).toList();
      }
      rows.assignAll(list);
      if (tabIndex.value == 0) {
        quotationListCount.value = list.length;
      }
    } catch (e) {
      errorMessage.value = e.toString();
      rows.clear();
    } finally {
      loading.value = false;
    }
  }

  static List<Map<String, dynamic>> _asMapList(dynamic res) {
    if (res is List) {
      return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    if (res is Map) {
      if (res['data'] is List) {
        return (res['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      for (final key in ['quotations', 'invoices', 'orders', 'customers']) {
        if (res[key] is List) {
          return (res[key] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
    }
    return [];
  }

  String documentLabel(Map<String, dynamic> r) {
    final customer = (r['customer_name'] ?? '—').toString();
    if (r.containsKey('quotation_number')) {
      final n = (r['quotation_number'] ?? r['id']).toString();
      return 'Quotation #$n for M/s.$customer';
    }
    if (r.containsKey('invoice_number')) {
      final n = (r['invoice_number'] ?? r['id']).toString();
      return 'Invoice #$n for M/s.$customer';
    }
    if (r.containsKey('order_number')) {
      final n = (r['order_number'] ?? r['id']).toString();
      return 'Order #$n for M/s.$customer';
    }
    final num = (r['id'] ?? '—').toString();
    return 'Document #$num for M/s.$customer';
  }

  String? _dateField(Map<String, dynamic> r) {
    if (r.containsKey('quotation_number')) {
      return (r['valid_until'] ?? r['created_at'])?.toString();
    }
    if (r.containsKey('invoice_number')) {
      return (r['invoice_date'] ?? r['created_at'])?.toString();
    }
    if (r.containsKey('order_number')) {
      return (r['order_date'] ?? r['created_at'])?.toString();
    }
    return r['created_at']?.toString();
  }

  String displayDate(Map<String, dynamic> r) {
    final raw = _dateField(r);
    if (raw == null || raw.isEmpty) return '—';
    return formatSalesCardDate(raw);
  }

  Future<void> deleteRowAt(int index) async {
    if (index < 0 || index >= rows.length) return;
    final r = rows[index];
    final id = r['id'];
    if (id == null) return;
    final path = switch (tabIndex.value) {
      0 => '/sales/quotations/$id',
      1 => '/sales/invoices/$id',
      2 => '/sales/orders/$id',
      3 => '/sales/customers/$id',
      _ => null,
    };
    if (path == null) return;
    await _auth.authorizedRequest(method: 'DELETE', path: path);
    await load();
  }
}
