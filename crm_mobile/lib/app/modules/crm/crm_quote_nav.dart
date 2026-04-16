import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/network/error_utils.dart';
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

Future<bool> _confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String yesLabel = 'Yes',
  String noLabel = 'No',
}) async {
  final res = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(noLabel)),
        FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(yesLabel)),
      ],
    ),
  );
  return res == true;
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
  var loaderVisible = false;
  void showLoader() {
    if (!context.mounted || loaderVisible) return;
    loaderVisible = true;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
  }

  void hideLoader() {
    if (!loaderVisible) return;
    loaderVisible = false;
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  try {
    final okCreateQuote = await _confirmDialog(
      context,
      title: 'Open Sales / Quote',
      message: 'Open Sales / Quote for this lead?',
      yesLabel: 'Yes',
      noLabel: 'No',
    );
    if (!okCreateQuote) {
      Get.snackbar('Cancelled', 'Sales / Quote action cancelled.', snackPosition: SnackPosition.BOTTOM);
      return;
    }

    showLoader();
    Map<String, dynamic>? linked = await fetchCustomerLinkedToLead(auth, lead.id);
    if (linked == null) {
      if (!context.mounted) return;
      // Pause loader while asking user confirmation.
      hideLoader();
      final okCreateCustomer = await _confirmDialog(
        context,
        title: 'Create customer',
        message: 'No customer linked to this lead. Create customer now?',
        yesLabel: 'Yes',
        noLabel: 'No',
      );
      if (!okCreateCustomer) {
        Get.snackbar('Cancelled', 'Customer creation cancelled. Quotation not opened.', snackPosition: SnackPosition.BOTTOM);
        return;
      }

      if (!context.mounted) return;
      showLoader();
      final conv = await auth.authorizedRequest(method: 'POST', path: '/crm/leads/${lead.id}/convert-customer');
      final customer = conv is Map ? conv['customer'] : null;
      if (customer is Map) {
        linked = Map<String, dynamic>.from(customer);
      } else {
        linked = await fetchCustomerLinkedToLead(auth, lead.id);
      }
      if (linked == null) {
        hideLoader();
        Get.snackbar('Sales', 'Customer could not be created from this lead.', snackPosition: SnackPosition.BOTTOM);
        return;
      }
      Get.snackbar('Sales', 'Customer created from lead.', snackPosition: SnackPosition.BOTTOM);
    }

    final customerId = (linked['id'] as num).toInt();
    final customerName = (linked['name'] ?? '').toString().trim();

    // Ensure lead address becomes customer address + shipping_address for quoting.
    // Backend conversion may not populate these fields consistently.
    final leadAddr = lead.address.trim();
    if (leadAddr.isNotEmpty) {
      final existingAddr = (linked['address'] ?? '').toString().trim();
      final existingShip = (linked['shipping_address'] ?? '').toString().trim();
      final needsAddr = existingAddr.isEmpty;
      final needsShip = existingShip.isEmpty;
      if (needsAddr || needsShip) {
        try {
          final body = <String, dynamic>{
            if (needsAddr) 'address': leadAddr,
            if (needsShip) 'shipping_address': leadAddr,
          };
          await auth.authorizedRequest(
            method: 'PATCH',
            path: '/sales/customers/$customerId',
            body: body,
          );
          // Keep local copy in sync for downstream reads in this flow.
          if (needsAddr) linked['address'] = leadAddr;
          if (needsShip) linked['shipping_address'] = leadAddr;
        } catch (_) {
          // Best-effort only; quoting can proceed without it.
        }
      }
    }

    final quotesRes = await auth.authorizedRequest(method: 'GET', path: '/sales/quotations');
    final quotes = _asCustomerOrQuotationList(quotesRes);
    final hasExistingQuotes = quotes.any((q) => (q['customer_id'] as num?)?.toInt() == customerId);

    if (hasExistingQuotes) {
      hideLoader();
      await Get.toNamed(
        AppRoutes.sales,
        arguments: {
          'initialTab': 'quotes',
          'filterCustomerId': customerId,
          if (customerName.isNotEmpty) 'filterCustomerName': customerName,
        },
      );
      return;
    }

    int? assignee = lead.assignedTo;
    try {
      final leadRes = await auth.authorizedRequest(method: 'GET', path: '/crm/leads/${lead.id}');
      final row = leadRes is Map ? (leadRes['lead'] ?? leadRes) : null;
      final raw = row is Map ? row['assigned_to'] : null;
      if (raw is num) {
        assignee = raw.toInt();
      } else if (raw != null) {
        assignee = int.tryParse(raw.toString());
      }
    } catch (_) {
      // Fallback to current lead payload if refresh fails.
    }
    if (assignee != null && assignee <= 0) assignee = null;

    // Dismiss loader before route transition to avoid overlay lingering.
    hideLoader();
    await Get.toNamed(
      AppRoutes.quotationForm,
      arguments: {
        'initialCustomerId': customerId,
        'forceCustomerPrefill': true,
        if (assignee != null) 'initialCreatedById': assignee,
      },
    );
  } catch (e) {
    hideLoader();
    if (context.mounted) {
      Get.snackbar('Sales', userFriendlyError(e), snackPosition: SnackPosition.BOTTOM);
    }
  }
}
