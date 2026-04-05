import 'package:get/get.dart';

import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart' show parseDynamicNum;
import '../auth/auth_controller.dart';

class QuotationDetailController extends GetxController {
  QuotationDetailController({required this.quotationId});

  final int quotationId;
  final AuthController _auth = Get.find<AuthController>();

  final isLoading = false.obs;
  final isSaving = false.obs;
  final errorMessage = ''.obs;
  final quotation = Rxn<Map<String, dynamic>>();

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    if (quotationId <= 0) return;
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(
        method: 'GET',
        path: '/sales/quotations/$quotationId',
      );
      final m = Map<String, dynamic>.from((res as Map)['quotation'] as Map);
      quotation.value = m;
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
      quotation.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> setStatus(String status) async {
    if (quotationId <= 0) return;
    isSaving.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/sales/quotations/$quotationId',
        body: {'status': status},
      );
      await load();
    } catch (e) {
      Get.snackbar('Error', userFriendlyError(e));
    } finally {
      isSaving.value = false;
    }
  }

  static List<Map<String, dynamic>> itemsOf(Map<String, dynamic>? q) {
    if (q == null) return [];
    final raw = q['items'];
    if (raw is! List) return [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static String customerName(Map<String, dynamic>? q) =>
      (q?['customer_name'] ?? '—').toString();

  static String statusOf(Map<String, dynamic>? q) =>
      (q?['status'] ?? 'draft').toString();

  static double lineAmount(Map<String, dynamic> item) =>
      parseDynamicNum(item['total']).toDouble();
}
