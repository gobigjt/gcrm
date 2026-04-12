import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../auth/auth_controller.dart';

/// Same list as web `Sales.jsx` `INDIAN_STATES`.
const List<String> kIndianSalesStates = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

bool salesCanAssignOtherExecutive(String role) {
  final r = role.trim();
  return r == 'Admin' || r == 'Super Admin' || r == 'Sales Manager';
}

/// Web-style `SectionCard`: rounded panel + titled header rule.
class SalesFormSectionCard extends StatelessWidget {
  const SalesFormSectionCard({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isDark ? const Color(0xFF13152A) : Colors.white,
      elevation: isDark ? 0 : 0.5,
      shadowColor: isDark ? Colors.transparent : Colors.black12,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isDark ? cs.outlineVariant.withValues(alpha: 0.65) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? cs.onSurface : const Color(0xFF334155),
              ),
            ),
            Divider(height: 20, thickness: 1, color: isDark ? cs.outlineVariant.withValues(alpha: 0.45) : const Color(0xFFF1F5F9)),
            child,
          ],
        ),
      ),
    );
  }
}

/// Customer + sales executive (matches web Bill To).
class SalesBillToFields extends StatelessWidget {
  const SalesBillToFields({
    super.key,
    required this.auth,
    required this.customers,
    required this.selectedCustomerId,
    required this.executives,
    required this.selectedCreatedById,
    required this.customerDecoration,
    required this.onCustomerChanged,
    required this.onExecutiveChanged,
    required this.sectionLabelStyle,
  });

  final AuthController auth;
  final RxList<Map<String, dynamic>> customers;
  final Rxn<int> selectedCustomerId;
  final RxList<Map<String, dynamic>> executives;
  final Rxn<int> selectedCreatedById;
  final InputDecoration Function(BuildContext context) customerDecoration;
  final ValueChanged<int?> onCustomerChanged;
  final ValueChanged<int?> onExecutiveChanged;
  final TextStyle Function(BuildContext context) sectionLabelStyle;

  @override
  Widget build(BuildContext context) {
    final canPick = salesCanAssignOtherExecutive(auth.role.value);
    final cs = Theme.of(context).colorScheme;
    return Obx(() {
      final execIds = executives.map((e) => (e['id'] as num).toInt()).toSet();
      final safeExec = selectedCreatedById.value != null && execIds.contains(selectedCreatedById.value!)
          ? selectedCreatedById.value
          : null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Customer *', style: sectionLabelStyle(context)),
          const SizedBox(height: 6),
          Builder(builder: (ctx) {
            final cur = selectedCustomerId.value;
            final ids = customers.map((cu) => (cu['id'] as num).toInt()).toSet();
            final safeVal = cur != null && ids.contains(cur) ? cur : null;
            return DropdownButtonFormField<int>(
              value: safeVal,
              decoration: customerDecoration(ctx),
              dropdownColor: Theme.of(ctx).brightness == Brightness.dark ? cs.surfaceContainerHighest : null,
              style: TextStyle(color: cs.onSurface, fontSize: 15, fontWeight: FontWeight.w500),
              items: customers
                  .map(
                    (cu) => DropdownMenuItem<int>(
                      value: (cu['id'] as num).toInt(),
                      child: Text((cu['name'] ?? '—').toString(), overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: onCustomerChanged,
            );
          }),
          const SizedBox(height: 12),
          Text('Sales Executive *', style: sectionLabelStyle(context)),
          const SizedBox(height: 6),
          if (executives.isEmpty)
            Text(
              'No sales executives found. Ask an admin to assign the Sales role.',
              style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
            )
          else
            DropdownButtonFormField<int>(
              value: safeExec,
              decoration: customerDecoration(context),
              dropdownColor: Theme.of(context).brightness == Brightness.dark ? cs.surfaceContainerHighest : null,
              style: TextStyle(color: cs.onSurface, fontSize: 15, fontWeight: FontWeight.w500),
              items: executives
                  .map(
                    (u) => DropdownMenuItem<int>(
                      value: (u['id'] as num).toInt(),
                      child: Text((u['name'] ?? '—').toString(), overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: canPick ? onExecutiveChanged : null,
            ),
          if (!canPick)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Only managers and admins can assign a different executive.',
                style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant),
              ),
            ),
        ],
      );
    });
  }
}
