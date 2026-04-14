import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/auth/role_permissions.dart';
import '../../core/utils/ui_format.dart';
import '../../routes/app_routes.dart';
import '../../shared/widgets/app_error_banner.dart';
import '../../shared/widgets/app_navigation_drawer.dart';
import '../../shared/widgets/role_aware_bottom_nav.dart';
import '../auth/auth_controller.dart';
import 'sales_controller.dart';
import 'sales_document_kind.dart';
import 'sales_document_pdf_service.dart';
import 'sales_document_detail_view.dart';

/// Dark app bar (matches CRM leads screen) + teal accents (reference Quotes & Invoices).
class _SalesChrome {
  static const barBg = Color(0xFF263238);
  static const teal = Color(0xFF26A69A);
}

class SalesView extends GetView<SalesController> {
  const SalesView({super.key});

  String _formatCreatedDateTime(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return '—';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    final local = dt.isUtc ? dt.toLocal() : dt;
    final ymd = formatIsoDate(local.toIso8601String());
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '$ymd $hh:$mm';
  }

  String _emptyLabel() {
    if (controller.isCustomersTab) {
      if (controller.filterCustomerId.value != null) return 'No customer match';
      return 'No customers yet';
    }
    if (controller.isQuotationsTab) {
      if (controller.filterCustomerId.value != null) return 'No quotations for this customer yet';
      return 'No quotations yet';
    }
    if (controller.isInvoicesTab) {
      if (controller.filterCustomerId.value != null) return 'No invoices for this customer yet';
      return 'No invoices yet';
    }
    if (controller.filterCustomerId.value != null) return 'No orders for this customer yet';
    return 'No orders yet';
  }

  Future<void> _downloadListPdf(BuildContext context, SalesDocumentKind kind, int id) async {
    if (id <= 0) return;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary)),
      ),
    );
    try {
      final auth = Get.find<AuthController>();
      await SalesDocumentPdfService.downloadById(auth: auth, kind: kind, id: id);
      if (context.mounted) {
        Get.snackbar('PDF', 'Ready — check downloads or the share sheet.');
      }
    } catch (e) {
      if (context.mounted) {
        Get.snackbar('PDF failed', e.toString());
      }
    } finally {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, int index) async {
    final ok = await Get.dialog<bool>(
      AlertDialog(
        title: const Text('Delete?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Get.back(result: true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) {
      try {
        await controller.deleteRowAt(index);
      } catch (e) {
        Get.snackbar('Error', e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: Obx(
        () => AppNavigationDrawer(
          currentRoute: AppRoutes.sales,
          section: switch (controller.tabIndex.value) {
            0 => 'quotes',
            1 => 'invoices',
            2 => 'orders',
            3 => 'customers',
            _ => 'quotes',
          },
        ),
      ),
      appBar: AppBar(
        backgroundColor: _SalesChrome.barBg,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        actionsIconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        title: const Text(
          'Quotes & Invoices',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        actions: [
          IconButton(
            tooltip: 'Settings',
            onPressed: () {
              if (!auth.hasPermission(AppPermissions.settings)) {
                Get.snackbar('Unavailable', "You don't have access to Settings.");
                return;
              }
              Get.toNamed(AppRoutes.settings);
            },
            icon: const Icon(Icons.settings_outlined),
          ),
          IconButton(
            onPressed: controller.load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: _SalesTabStrip(controller: controller),
        ),
      ),
      floatingActionButton: controller.isCustomersTab
          ? null
          : FloatingActionButton(
        onPressed: () async {
          if (controller.isQuotationsTab) {
            final cid = controller.filterCustomerId.value;
            final r = await Get.toNamed(
              AppRoutes.quotationForm,
              arguments: cid != null ? {'initialCustomerId': cid} : null,
            );
            if (r == true) await controller.load();
            return;
          }
          if (controller.isInvoicesTab) {
            final cid = controller.filterCustomerId.value;
            final r = await Get.toNamed(
              AppRoutes.invoiceForm,
              arguments: cid != null ? {'initialCustomerId': cid} : null,
            );
            if (r == true) await controller.load();
            return;
          }
          final cid = controller.filterCustomerId.value;
          final r = await Get.toNamed(
            AppRoutes.orderForm,
            arguments: cid != null ? {'initialCustomerId': cid} : null,
          );
          if (r == true) await controller.load();
        },
        backgroundColor: _SalesChrome.teal,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      bottomNavigationBar: const RoleAwareBottomNav(currentRoute: AppRoutes.sales),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Obx(
            () => AppErrorBanner(
              message: controller.errorMessage.value ?? '',
              onRetry: controller.load,
            ),
          ),
          Obx(() {
            final id = controller.filterCustomerId.value;
            if (id == null) return const SizedBox.shrink();
            final name = controller.filterCustomerName.value ?? 'Customer #$id';
            final filterDark = Theme.of(context).brightness == Brightness.dark;
            return Material(
              color: filterDark ? const Color(0xFF0D2818) : const Color(0xFFE8F5E9),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.filter_alt_outlined,
                      size: 18,
                      color: filterDark ? const Color(0xFF81C784) : const Color(0xFF2E7D32),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Sales for $name',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: filterDark ? const Color(0xFFC8E6C9) : const Color(0xFF1B5E20),
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: controller.clearCustomerFilter,
                      child: const Text('Show all'),
                    ),
                  ],
                ),
              ),
            );
          }),
          Obx(() => controller.loading.value ? const LinearProgressIndicator(minHeight: 2) : const SizedBox.shrink()),
          Expanded(
            child: Obx(() {
              if (controller.rows.isEmpty && !controller.loading.value) {
                return Center(
                  child: Text(
                    _emptyLabel(),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).hintColor),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                itemCount: controller.rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final r = controller.rows[i];
                  final id = (r['id'] as num?)?.toInt() ?? 0;
                  final isQ = controller.isQuotationsTab;
                  final isInv = controller.isInvoicesTab;
                  final isOrd = controller.isOrdersTab;
                  final isCustomers = controller.isCustomersTab;
                  final canDeleteCustomer = auth.role.value == AppRoles.admin || auth.role.value == AppRoles.superAdmin;
                  if (isCustomers) {
                    return _CustomerCard(
                      name: (r['name'] ?? '—').toString(),
                      phone: (r['phone'] ?? '—').toString(),
                      email: (r['email'] ?? '—').toString(),
                      createdBy: (r['created_by_name'] ?? '—').toString(),
                      createdDateTime: _formatCreatedDateTime(r['created_at']),
                      onDelete: canDeleteCustomer ? () => _confirmDelete(context, i) : null,
                    );
                  }
                  final docKind = isQ
                      ? SalesDocumentKind.quotation
                      : isInv
                          ? SalesDocumentKind.invoice
                          : SalesDocumentKind.order;
                  return _SalesDocumentCard(
                    title: controller.documentLabel(r),
                    customer: (r['customer_name'] ?? '—').toString(),
                    dateLine: controller.displayDate(r),
                    amountLine: formatInrLine(r['total_amount']),
                    onEdit: isQ && id > 0
                        ? () async {
                            final ok = await Get.toNamed(
                              AppRoutes.quotationForm,
                              arguments: {'quotationId': id},
                            );
                            if (ok == true) await controller.load();
                          }
                        : isInv && id > 0
                            ? () async {
                                final ok = await Get.toNamed(
                                  AppRoutes.invoiceForm,
                                  arguments: {'invoiceId': id},
                                );
                                if (ok == true) await controller.load();
                              }
                            : isOrd
                                ? () => Get.snackbar(
                                      'Sales order',
                                      'Change status from the document view. Line edits use the web app.',
                                    )
                                : () => Get.snackbar('Edit', 'Nothing to edit.'),
                    onCopy: isQ && id > 0
                        ? () async {
                            final ok = await Get.toNamed(
                              AppRoutes.quotationForm,
                              arguments: {'copyFromId': id},
                            );
                            if (ok == true) await controller.load();
                          }
                        : () => Get.snackbar('Copy', 'Copy is only available for quotations.'),
                    onDelete: () => _confirmDelete(context, i),
                    onPdf: id > 0 ? () => _downloadListPdf(context, docKind, id) : () {},
                    onView: id > 0
                        ? () async {
                            await Get.to(() => SalesDocumentDetailView(kind: docKind, documentId: id));
                            await controller.load();
                          }
                        : () => Get.snackbar('View', 'Invalid document.', snackPosition: SnackPosition.BOTTOM),
                  );
                },
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _SalesTabStrip extends StatelessWidget {
  const _SalesTabStrip({required this.controller});

  final SalesController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final t = controller.tabIndex.value;
      final bc = controller.quotationListCount.value;
      return Container(
      width: double.infinity,
      color: _SalesChrome.barBg,
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 0),
      child: Row(
        children: [
          Expanded(
            child: _SalesTabButton(
              label: 'QUOTE',
              selected: t == 0,
              badgeCount: bc,
              showBadge: bc > 0,
              onTap: () => controller.selectTab(0),
            ),
          ),
          Expanded(
            child: _SalesTabButton(
              label: 'INVOICE',
              selected: t == 1,
              onTap: () => controller.selectTab(1),
            ),
          ),
          Expanded(
            child: _SalesTabButton(
              label: 'ORDERS',
              selected: t == 2,
              onTap: () => controller.selectTab(2),
            ),
          ),
          Expanded(
            child: _SalesTabButton(
              label: 'CUSTOMERS',
              selected: t == 3,
              onTap: () => controller.selectTab(3),
            ),
          ),
        ],
      ),
    );
    });
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({
    required this.name,
    required this.phone,
    required this.email,
    required this.createdBy,
    required this.createdDateTime,
    this.onDelete,
  });

  final String name;
  final String phone;
  final String email;
  final String createdBy;
  final String createdDateTime;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: scheme.onSurface)),
            const SizedBox(height: 6),
            Text('Phone: $phone', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
            Text('Email: $email', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
            Text('Created by: $createdBy', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
            Text('Created at: $createdDateTime', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
            if (onDelete != null) ...[
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline, color: Color(0xFFE53935)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SalesTabButton extends StatelessWidget {
  const _SalesTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
    this.showBadge = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badgeCount;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected ? _SalesChrome.teal : Colors.white.withValues(alpha: 0.65),
                    letterSpacing: 0.6,
                  ),
                ),
                if (showBadge) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: const BoxDecoration(color: Color(0xFFE53935), shape: BoxShape.circle),
                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                    alignment: Alignment.center,
                    child: Text(
                      badgeCount > 9 ? '9+' : '$badgeCount',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 6),
            Container(
              height: 2.5,
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: selected ? _SalesChrome.teal : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SalesDocumentCard extends StatelessWidget {
  const _SalesDocumentCard({
    required this.title,
    required this.customer,
    required this.dateLine,
    required this.amountLine,
    required this.onEdit,
    required this.onCopy,
    required this.onPdf,
    required this.onDelete,
    required this.onView,
  });

  final String title;
  final String customer;
  final String dateLine;
  final String amountLine;
  final VoidCallback onEdit;
  final VoidCallback onCopy;
  final VoidCallback onPdf;
  final VoidCallback onDelete;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: scheme.surfaceContainer,
      elevation: isDark ? 0 : 1.5,
      shadowColor: isDark ? Colors.transparent : Colors.black26,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isDark ? scheme.outlineVariant : Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.description_outlined, size: 28, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: scheme.onSurface,
                            height: 1.25,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 1),
                              child: Icon(Icons.person_outline, size: 15, color: scheme.onSurfaceVariant),
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                customer,
                                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, height: 1.2),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        dateLine,
                        style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        amountLine,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: _SalesChrome.teal,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Divider(height: 1, thickness: 1, color: scheme.outlineVariant.withValues(alpha: isDark ? 0.7 : 1)),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _CardIconAction(icon: Icons.edit_outlined, color: const Color(0xFF185FA5), onTap: onEdit),
                  _CardIconAction(icon: Icons.copy_outlined, color: const Color(0xFFEF9F27), onTap: onCopy),
                  _CardIconAction(icon: Icons.picture_as_pdf_outlined, color: const Color(0xFFC62828), onTap: onPdf),
                  _CardIconAction(icon: Icons.delete_outline, color: const Color(0xFFE53935), onTap: onDelete),
                  _CardIconAction(icon: Icons.visibility_outlined, color: const Color(0xFF1D9E75), onTap: onView),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardIconAction extends StatelessWidget {
  const _CardIconAction({required this.icon, required this.color, required this.onTap});

  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, color: color, size: 22),
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 40),
    );
  }
}
