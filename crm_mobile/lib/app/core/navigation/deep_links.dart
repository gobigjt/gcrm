import 'package:get/get.dart';

/// Opens lead detail. Use from push handlers when payload includes `lead_id`.
/// Matches GetPage `AppRoutes.leadDetail` (`/lead/:id`).
void openLeadDeepLink(int leadId) {
  if (leadId <= 0) return;
  Get.toNamed('/lead/$leadId');
}
