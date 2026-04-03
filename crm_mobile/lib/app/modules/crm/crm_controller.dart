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
  final searchQuery = ''.obs;

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
      final q = searchQuery.value.trim();
      if (q.isNotEmpty) query.add('search=${Uri.encodeComponent(q)}');
      final path = query.isEmpty ? '/crm/leads' : '/crm/leads?${query.join('&')}';
      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: path);
      leads.assignAll((leadsRes as List).map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))));
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<int?> createLead({
    required String name,
    String? email,
    String? phone,
    String? company,
    int? sourceId,
  }) async {
    isSubmitting.value = true;
    try {
      final body = <String, dynamic>{
        'name': name,
        'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
        'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
        'company': (company ?? '').trim().isEmpty ? null : company!.trim(),
        'priority': 'warm',
        if (sourceId != null) 'source_id': sourceId,
        if (selectedStageId.value != null) 'stage_id': selectedStageId.value,
      };
      final created = await _auth.authorizedRequest(method: 'POST', path: '/crm/leads', body: body);
      await applyFilters();
      final rawId = (created as Map<String, dynamic>)['id'];
      if (rawId is int) return rawId;
      if (rawId is num) return rawId.toInt();
      return int.tryParse(rawId?.toString() ?? '');
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> addFollowup({
    required int leadId,
    required String dueDate,
    required String description,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/crm/leads/$leadId/followups',
        body: {'due_date': dueDate, 'description': description},
      );
      await applyFilters();
    } finally {
      isSubmitting.value = false;
    }
  }
}
