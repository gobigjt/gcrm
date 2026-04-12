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
  /// Full list for stage-filter chip counts (stays populated when filters apply).
  final leadsAll = <CrmLead>[].obs;
  final stages = <CrmLookupItem>[].obs;
  final sources = <CrmLookupItem>[].obs;
  final selectedStageId = RxnInt();
  final selectedSourceId = RxnInt();
  final searchQuery = ''.obs;
  /// `YYYY-MM-DD` for API `created_from` / `created_to` (inclusive range).
  final createdFromYmd = Rx<String?>(null);
  final createdToYmd = Rx<String?>(null);

  bool get _ownAssignedOnly {
    final role = _auth.role.value.trim().toLowerCase();
    return role == 'sales executive' || role == 'sales manager';
  }

  @override
  void onInit() {
    super.onInit();
    _bootstrap();
  }

  int? _sourceIdFromArgs() {
    final a = Get.arguments;
    if (a is! Map) return null;
    final v = a['sourceId'] ?? a['source_id'];
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }

  Future<void> _bootstrap() async {
    final fromLists = _sourceIdFromArgs();
    await loadInitial();
    if (fromLists != null) {
      selectedSourceId.value = fromLists;
      await applyFilters();
    }
  }

  Future<void> loadInitial() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final scopedPath = _ownAssignedOnly && _auth.userId.value > 0
          ? '/crm/leads?assigned_to=${_auth.userId.value}'
          : '/crm/leads';
      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: scopedPath);
      final stagesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/stages');
      final sourcesRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/sources');
      leads.assignAll((leadsRes as List).map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))));
      leadsAll.assignAll(leads);
      stages.assignAll((stagesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))));
      sources.assignAll((sourcesRes as List).map((e) => CrmLookupItem.fromJson(Map<String, dynamic>.from(e as Map))));
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  void clearCreatedDateFilter() {
    createdFromYmd.value = null;
    createdToYmd.value = null;
    applyFilters();
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
      final from = createdFromYmd.value?.trim();
      final to = createdToYmd.value?.trim();
      if (from != null && from.isNotEmpty) {
        query.add('created_from=${Uri.encodeComponent(from)}');
      }
      if (to != null && to.isNotEmpty) {
        query.add('created_to=${Uri.encodeComponent(to)}');
      }
      if (_ownAssignedOnly && _auth.userId.value > 0) {
        query.add('assigned_to=${_auth.userId.value}');
      }
      final path = query.isEmpty ? '/crm/leads' : '/crm/leads?${query.join('&')}';
      final leadsRes = await _auth.authorizedRequest(method: 'GET', path: path);
      leads.assignAll((leadsRes as List).map((e) => CrmLead.fromJson(Map<String, dynamic>.from(e as Map))));
      if (selectedStageId.value == null &&
          selectedSourceId.value == null &&
          searchQuery.value.trim().isEmpty &&
          (createdFromYmd.value == null || createdFromYmd.value!.trim().isEmpty) &&
          (createdToYmd.value == null || createdToYmd.value!.trim().isEmpty)) {
        leadsAll.assignAll(leads);
      }
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
    String? leadSegment,
    String? jobTitle,
    String? website,
    String? address,
    String? notes,
    List<String>? tags,
    double? dealSize,
    double? leadScore,
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
        if (leadSegment != null && leadSegment.trim().isNotEmpty) 'lead_segment': leadSegment.trim(),
        if (jobTitle != null && jobTitle.trim().isNotEmpty) 'job_title': jobTitle.trim(),
        if (website != null && website.trim().isNotEmpty) 'website': website.trim(),
        if (address != null && address.trim().isNotEmpty) 'address': address.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        if (tags != null && tags.isNotEmpty) 'tags': tags,
        if (dealSize != null) 'deal_size': dealSize,
        'lead_score': leadScore ?? 0,
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
