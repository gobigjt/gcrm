import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/models/crm_models.dart';
import '../../routes/app_routes.dart';
import '../auth/auth_controller.dart';

List<Map<String, dynamic>> _asCustomerOrQuotationList(dynamic res) {
  if (res is List) {
    return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
  if (res is Map) {
    for (final key in ['quotations', 'customers', 'data']) {
      final list = res[key];
      if (list is List) {
        return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
  }
  return [];
}

/// Customer row whose `lead_id` matches [leadId], or null.
Future<Map<String, dynamic>?> fetchCustomerLinkedToLead(AuthController auth, int leadId) async {
  final customersRes = await auth.authorizedRequest(method: 'GET', path: '/sales/customers');
  final customers = _asCustomerOrQuotationList(customersRes);
  for (final c in customers) {
    final lid = c['lead_id'];
    if (lid != null && (lid as num).toInt() == leadId) {
      return c;
    }
  }
  return null;
}

/// From CRM lead: open quotes for the linked customer, or new quotation if none / no customer.
Future<void> navigateQuoteFlowForLead(BuildContext context, CrmLead lead) async {
  final auth = Get.find<AuthController>();
  if (!auth.hasPermission(AppPermissions.sales)) {
    Get.snackbar('Unavailable', "You don't have access to Sales.");
    return;
  }
  try {
    final linked = await fetchCustomerLinkedToLead(auth, lead.id);

    if (linked == null) {
      await Get.toNamed(AppRoutes.quotationForm);
      return;
    }

    final customerId = (linked['id'] as num).toInt();
    final customerName = (linked['name'] ?? '').toString().trim();

    final quotesRes = await auth.authorizedRequest(method: 'GET', path: '/sales/quotations');
    final quotes = _asCustomerOrQuotationList(quotesRes);
    final forClient = quotes.where((q) => (q['customer_id'] as num?)?.toInt() == customerId).toList();

    if (forClient.isEmpty) {
      await Get.toNamed(
        AppRoutes.quotationForm,
        arguments: {'initialCustomerId': customerId},
      );
      return;
    }

    await Get.toNamed(
      AppRoutes.sales,
      arguments: {
        'initialTab': 'quotes',
        'filterCustomerId': customerId,
        if (customerName.isNotEmpty) 'filterCustomerName': customerName,
      },
    );
  } catch (e) {
    if (context.mounted) {
      Get.snackbar('Sales', e.toString(), snackPosition: SnackPosition.BOTTOM);
    }
  }
}

/// From CRM lead: Sales hub — filtered by linked customer when one exists, else full Sales.
Future<void> navigateSalesFlowForLead(BuildContext context, CrmLead lead) async {
  final auth = Get.find<AuthController>();
  if (!auth.hasPermission(AppPermissions.sales)) {
    Get.snackbar('Unavailable', "You don't have access to Sales.");
    return;
  }
  try {
    final linked = await fetchCustomerLinkedToLead(auth, lead.id);

    if (linked == null) {
      await Get.toNamed(AppRoutes.sales);
      return;
    }

    final customerId = (linked['id'] as num).toInt();
    final customerName = (linked['name'] ?? '').toString().trim();

    await Get.toNamed(
      AppRoutes.sales,
      arguments: {
        'initialTab': 'quotes',
        'filterCustomerId': customerId,
        if (customerName.isNotEmpty) 'filterCustomerName': customerName,
      },
    );
  } catch (e) {
    if (context.mounted) {
      Get.snackbar('Sales', e.toString(), snackPosition: SnackPosition.BOTTOM);
    }
  }
}
