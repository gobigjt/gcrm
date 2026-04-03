import 'package:get/get.dart';

import '../../core/models/crm_models.dart';
import '../../core/models/communication_models.dart';
import '../../core/network/error_utils.dart';
import '../auth/auth_controller.dart';

class WhatsAppChatController extends GetxController {
  WhatsAppChatController({required this.leadId});

  final int leadId;
  final AuthController _auth = Get.find<AuthController>();

  final errorMessage = ''.obs;
  final isLoading = false.obs;
  final isSubmitting = false.obs;

  final lead = Rxn<CrmLead>();
  final messages = <CommLogRow>[].obs;
  final templates = <CommTemplateRow>[].obs;

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
      lead.value = CrmLead.fromJson(Map<String, dynamic>.from((leadRes as Map)['lead'] as Map));

      final logsRes = await _auth.authorizedRequest(
        method: 'GET',
        path: '/communication/logs?lead_id=$leadId&channel=whatsapp',
      );

      messages.assignAll(
        (logsRes as List).map((e) => CommLogRow.fromJson(Map<String, dynamic>.from(e as Map))),
      );

      // Load templates once (for the "Template" chip).
      if (templates.isEmpty) {
        final tRes = await _auth.authorizedRequest(method: 'GET', path: '/communication/templates');
        final all = (tRes as List).map((e) => CommTemplateRow.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        templates.assignAll(all.where((t) => t.channel == 'whatsapp'));
      }
    } catch (e) {
      errorMessage.value = userFriendlyError(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> sendMessage(String body) async {
    final text = body.trim();
    if (text.isEmpty) return;

    isSubmitting.value = true;
    try {
      final recipient = (lead.value?.phone ?? '').trim();
      await _auth.authorizedRequest(
        method: 'POST',
        path: '/communication/logs',
        body: {
          'lead_id': leadId,
          'channel': 'whatsapp',
          'recipient': recipient.isEmpty ? 'unknown' : recipient,
          'body': text,
          'status': 'sent',
        },
      );
      await load();
    } finally {
      isSubmitting.value = false;
    }
  }
}

