import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../auth/auth_controller.dart';

class TasksController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;

  final items = <CrmFollowupRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    load();
  }

  Future<void> load() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      // Prototype: fetch all open follow-ups (not marked done yet).
      final res = await _auth.authorizedRequest(
        method: 'GET',
        path: '/crm/leads/followups',
      );
      items.assignAll(
        (res as List).map((e) => CrmFollowupRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = e.toString();
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> markDone(CrmFollowupRow followup) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'PATCH',
        path: '/crm/leads/${followup.leadId}/followups/${followup.id}/done',
      );
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }
}

