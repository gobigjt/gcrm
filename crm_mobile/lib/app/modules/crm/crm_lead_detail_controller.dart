import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/network/error_utils.dart';
import '../../core/utils/ui_format.dart' show dueDateForTimestamptzApi;
import '../auth/auth_controller.dart';

class CrmLeadDetailController extends GetxController {
  CrmLeadDetailController({required this.leadId});

  final int leadId;
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final lead = Rxn<CrmLead>();
  final activities = <CrmActivityRow>[].obs;
  final followups = <CrmFollowupRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      final leadRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/$leadId');
      final actRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/$leadId/activities');
      final folRes = await _auth.authorizedRequest(method: 'GET', path: '/crm/leads/$leadId/followups');
      lead.value = CrmLead.fromJson(
        Map<String, dynamic>.from((leadRes as Map)['lead'] as Map),
      );
      activities.assignAll(
        (actRes as List).map((e) => CrmActivityRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
      followups.assignAll(
        (folRes as List).map((e) => CrmFollowupRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> addActivity({
    required String type,
    required String description,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/crm/leads/$leadId/activities',
        body: {'type': type, 'description': description},
      );
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> addFollowup({
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
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> markFollowupDone(int followupId) async {
    await _auth.authorizedRequest(
      method: 'PATCH',
      path: '/crm/leads/$leadId/followups/$followupId/done',
    );
    await load();
  }

  Future<void> updateFollowup({
    required int followupId,
    required String dueDate,
    required String description,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/crm/leads/$leadId/followups/$followupId',
        body: {
          'due_date': dueDateForTimestamptzApi(dueDate),
          'description': description,
        },
      );
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> deleteFollowup(int followupId) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'DELETE',
        path: '/crm/leads/$leadId/followups/$followupId',
      );
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }

  /// Creates a Sales customer from this lead’s contact fields (`POST …/convert-customer`).
  Future<Map<String, dynamic>?> convertToCustomer() async {
    isSubmitting.value = true;
    try {
      final res = await _auth.authorizedRequest(
        method: 'POST',
        path: '/crm/leads/$leadId/convert-customer',
      );
      await load();
      if (res is Map<String, dynamic>) return res;
      if (res is Map) return Map<String, dynamic>.from(res);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }
}
