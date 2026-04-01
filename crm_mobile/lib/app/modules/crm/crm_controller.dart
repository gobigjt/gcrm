import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class CrmController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final leads = <CrmLead>[].obs;
  final stages = <CrmLookupItem>[].obs;
  final sources = <CrmLookupItem>[].obs;
  final selectedStageId = RxnInt();
  final selectedSourceId = RxnInt();

  @override
  void onInit() {
    super.onInit();
    loadInitial();
  }

  Future<void> loadInitial() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads');
      final stagesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/stages');
      final sourcesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/sources');
      leads.assignAll((leadsRes as List).map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))));
      stages.assignAll((stagesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))));
      sources.assignAll((sourcesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))));
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> applyFilters() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final query = <String>[];
      if (selectedStageId.value != null) query.add('stage_id=${selectedStageId.value}');
      if (selectedSourceId.value != null) query.add('source_id=${selectedSourceId.value}');
      final path = query.isEmpty ? '/crm/leads' : '/crm/leads?${query.join('&')}';
      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: path);
      leads.assignAll((leadsRes as List).map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))));
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> createLead({
    required String name,
    String? email,
    String? phone,
    String? company,
  }) async {
    isSubmitting.value = true;
    try {
      final body = <String, dynamic>{
        'name': name,
        'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
        'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
        'company': (company ?? '').trim().isEmpty ? null : company!.trim(),
        'priority': 'warm',
        if (selectedSourceId.value != null) 'source_id': selectedSourceId.value,
        if (selectedStageId.value != null) 'stage_id': selectedStageId.value,
      };
      await _auth.authorizedRequest(method: 'POST', path: '/crm/leads', body: body);
      await applyFilters();
    } finally {
      isSubmitting.value = false;
    }
  }
}
