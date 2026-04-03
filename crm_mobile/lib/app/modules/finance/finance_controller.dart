import 'package:get/get.dart';

import '../../core/models/finance_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class FinanceController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final errorMessage = ''.obs;

  final fromDate = ''.obs;
  final toDate = ''.obs;

  final summary = Rxn<FinanceSummary>();
  final plRows = <PLReportRow>[].obs;
  final gstInvoices = <GstInvoiceRow>[].obs;
  final gstTotals = Rxn<GstTotals>();
  /// Accounts invoices list filter: `all` | `paid` | `overdue` (client-side, showcase).
  final invoiceListFilter = 'all'.obs;
  final invoiceSearchQuery = ''.obs;

  @override
  void onInit() {
    super.onInit();
    final now = DateTime.now();
    final first = DateTime(now.year, now.month, 1);
    fromDate.value = _fmtDate(first);
    toDate.value = _fmtDate(now);
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final s = await _auth.authorizedRequest(method: 'GET', path: '/finance/summary');
      final pl = await _auth.authorizedRequest(
        method: 'GET',
        path: '/finance/reports/pl?from=${fromDate.value}&to=${toDate.value}',
      );
      final gst = await _auth.authorizedRequest(
        method: 'GET',
        path: '/finance/reports/gst?from=${fromDate.value}&to=${toDate.value}',
      );
      summary.value = FinanceSummary.fromJson(Map<String, dynamic>.from(s as Map));
      plRows.assignAll(
        (pl as List).map((e) => PLReportRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
      final g = Map<String, dynamic>.from(gst as Map);
      gstInvoices.assignAll(
        (g['invoices'] as List? ?? const []).map(
          (e) => GstInvoiceRow.fromJson(Map<String, dynamic>.from(e as Map)),
        ),
      );
      final t = g['totals'];
      gstTotals.value = t is Map
          ? GstTotals.fromJson(Map<String, dynamic>.from(t))
          : GstTotals.empty;
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> setDateRange({
    required String from,
    required String to,
  }) async {
    fromDate.value = from;
    toDate.value = to;
    await loadAll();
  }

  String _fmtDate(DateTime d) {
    final mm = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '${d.year}-$mm-$dd';
  }
}
