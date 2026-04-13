import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart' show dueDateForTimestamptzApi;
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

  final reportingExecutives = <Map<String, dynamic>>[].obs;

  bool get _ownAssignedOnly {
    final role = _auth.role.value.trim().toLowerCase();
    return role == 'sales executive' || role == 'sales manager';
  }

  bool get _isSalesManager => _auth.role.value.trim().toLowerCase() == 'sales manager';

  /// Public for CRM views (e.g. source-counts) to align with lead list scope.
  bool get isSalesManager => _isSalesManager;

  String _scopedLeadsQueryPrefix() {
    if (!_ownAssignedOnly || _auth.userId.value <= 0) return '';
    final uid = _auth.userId.value;
    if (_isSalesManager && _auth.crmExecutiveScopeId.value != null) {
      return 'assigned_to=${_auth.crmExecutiveScopeId.value}';
    }
    return 'assigned_to=$uid';
  }

  Future<void> setTeamExecutiveFilter(int? executiveUserId) async {
    _auth.crmExecutiveScopeId.value = executiveUserId;
    await loadInitial();
    await applyFilters();
  }

  Future<void> _loadReportingExecutives() async {
    if (!_isSalesManager) {
      reportingExecutives.clear();
      return;
    }
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/reporting-executives');
      reportingExecutives.assignAll(
        (res as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
      );
    } catch (_) {
      reportingExecutives.clear();
    }
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
      await _loadReportingExecutives();
      final q = _scopedLeadsQueryPrefix();
      final scopedPath = q.isEmpty ? '/crm/leads' : '/crm/leads?$q';
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
      final scopeQ = _scopedLeadsQueryPrefix();
      if (scopeQ.isNotEmpty) {
        query.add(scopeQ);
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
    int? stageId,
    int? assignedTo,
    int? assignedManagerId,
    String? priority,
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
      final normalizedPriority = (priority ?? 'warm').trim();
      final body = <String, dynamic>{
        'name': name,
        'email': (email ?? '').trim().isEmpty ? null : email!.trim(),
        'phone': (phone ?? '').trim().isEmpty ? null : phone!.trim(),
        'company': (company ?? '').trim().isEmpty ? null : company!.trim(),
        'priority': normalizedPriority.isEmpty ? 'warm' : normalizedPriority,
        if (sourceId != null) 'source_id': sourceId,
        if (stageId != null) 'stage_id': stageId,
        if (assignedTo != null) 'assigned_to': assignedTo,
        if (assignedManagerId != null) 'assigned_manager_id': assignedManagerId,
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
        body: {'due_date': dueDateForTimestamptzApi(dueDate), 'description': description},
      );
      await applyFilters();
    } finally {
      isSubmitting.value = false;
    }
  }
}
