import 'package:get/get.dart';

import '../../core/models/communication_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class CommunicationController extends GetxController {
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;
  final selectedTab = 0.obs;
  final channelFilter = ''.obs;

  final templates = <CommTemplateRow>[].obs;
  final logs = <CommLogRow>[].obs;

  @override
  void onInit() {
    super.onInit();
    loadAll();
  }

  Future<void> loadAll() async {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      await Future.wait([loadTemplates(), loadLogs()]);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> loadTemplates() async {
    errorMessage.value = '';
    try {
      final res = await _auth.authorizedRequest(method: 'GET', path: '/communication/templates');
      templates.assignAll(
        (res as List).map((e) => CommTemplateRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> loadLogs() async {
    errorMessage.value = '';
    try {
      final channel = channelFilter.value.trim();
      final path = channel.isEmpty ? '/communication/logs' : '/communication/logs?channel=$channel';
      final res = await _auth.authorizedRequest(method: 'GET', path: path);
      logs.assignAll(
        (res as List).map((e) => CommLogRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    }
  }

  Future<void> createTemplate({
    required String name,
    required String channel,
    String? subject,
    required String body,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/communication/templates',
        body: {
          'name': name,
          'channel': channel,
          'subject': (subject ?? '').trim().isEmpty ? null : subject!.trim(),
          'body': body,
        },
      );
      await loadTemplates();
    } finally {
      isSubmitting.value = false;
    }
  }

  Future<void> createLog({
    int? leadId,
    required String channel,
    required String recipient,
    String? subject,
    required String body,
    String? status,
  }) async {
    isSubmitting.value = true;
    try {
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/communication/logs',
        body: {
          'lead_id': leadId,
          'channel': channel,
          'recipient': recipient,
          'subject': (subject ?? '').trim().isEmpty ? null : subject!.trim(),
          'body': body,
          'status': (status ?? '').trim().isEmpty ? 'sent' : status!.trim(),
        },
      );
      await loadLogs();
    } finally {
      isSubmitting.value = false;
    }
  }
}
