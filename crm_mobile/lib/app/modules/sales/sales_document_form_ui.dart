import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/product_catalog.dart';

/// Shared chrome for quotation / order / invoice forms (matches `QuotationFormView`).
const Color kSalesAccent = Color(0xFF26A69A);
const Color kSalesLightAppBarBg = Color(0xFF263238);

// ─── Dropdown option lists (mirrors web Sales.jsx constants) ─────────────────

const kPaymentTermsOptions = [
  'Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days',
  'Due on Receipt', 'Cash on Delivery', 'Advance Payment',
];

const kPaymentMethodOptions = [
  'Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Other',
];

// ─── GST Type radio widget ────────────────────────────────────────────────────

/// Compact segmented-style radio row for GST type / Tax type selection.
Widget salesRadioGroup({
  required BuildContext context,
  required String label,
  required List<(String, String)> options, // (value, display)
  required String selected,
  required ValueChanged<String> onChanged,
}) {
  final cs    = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isDark ? cs.onSurfaceVariant : const Color(0xFF334155),
            letterSpacing: 0.3,
          )),
      const SizedBox(height: 6),
      Wrap(
        spacing: 8,
        runSpacing: 6,
        children: options.map(((String, String) opt) {
          final (value, display) = opt;
          final active = selected == value;
          return GestureDetector(
            onTap: () => onChanged(value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: active
                    ? (isDark ? kSalesAccent.withValues(alpha: 0.22) : kSalesAccent.withValues(alpha: 0.12))
                    : cs.surfaceContainer,
                border: Border.all(
                  color: active ? kSalesAccent : (isDark ? cs.outlineVariant : Colors.grey.shade300),
                  width: active ? 1.8 : 1,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                display,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? kSalesAccent : cs.onSurfaceVariant,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    ],
  );
}

// ─── Extra-charges / payment section card ────────────────────────────────────

/// Compact section header used inside form cards.
Widget salesSectionHeader(BuildContext context, String title) {
  final cs    = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        Expanded(child: Divider(color: isDark ? cs.outlineVariant : Colors.grey.shade300)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: isDark ? cs.onSurfaceVariant : const Color(0xFF334155),
            ),
          ),
        ),
        Expanded(child: Divider(color: isDark ? cs.outlineVariant : Colors.grey.shade300)),
      ],
    ),
  );
}

/// Two-column numeric field row used in the extra-charges card.
Widget salesTwoColRow({
  required BuildContext context,
  required String label1,
  required TextEditingController ctrl1,
  required String label2,
  required TextEditingController ctrl2,
  required VoidCallback onChanged,
}) {
  caption(String t) => Text(t,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: Theme.of(context).brightness == Brightness.dark
            ? Theme.of(context).colorScheme.onSurfaceVariant
            : const Color(0xFF334155),
      ));
  field(TextEditingController c) => TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 14),
        decoration: salesOutlineField(context, hintText: '0.00'),
        onChanged: (_) => onChanged(),
      );
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          caption(label1),
          const SizedBox(height: 4),
          field(ctrl1),
        ]),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          caption(label2),
          const SizedBox(height: 4),
          field(ctrl2),
        ]),
      ),
    ],
  );
}

/// Dropdown row for payment terms / method.
Widget salesDropdownRow({
  required BuildContext context,
  required String label,
  required List<String> options,
  required String value,
  required ValueChanged<String> onChanged,
  String hint = 'Select…',
}) {
  final cs    = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
            color: isDark ? cs.onSurfaceVariant : const Color(0xFF334155),
          )),
      const SizedBox(height: 4),
      DropdownButtonFormField<String>(
        value: value.isEmpty ? null : value,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: cs.onSurfaceVariant.withValues(alpha: 0.7), fontSize: 14),
          filled: true,
          fillColor: cs.surfaceContainer,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: salesFieldBorder(context),
          enabledBorder: salesFieldBorder(context),
          focusedBorder: salesFieldBorder(context, focused: true),
        ),
        dropdownColor: isDark ? cs.surfaceContainerHighest : null,
        style: TextStyle(color: cs.onSurface, fontSize: 14),
        items: [
          DropdownMenuItem<String>(value: '', child: Text(hint, style: TextStyle(color: cs.onSurfaceVariant))),
          ...options.map((o) => DropdownMenuItem<String>(value: o, child: Text(o))),
        ],
        onChanged: (v) => onChanged(v ?? ''),
      ),
    ],
  );
}

Widget salesCustomerAddressPreview(
  BuildContext context, {
  required Map<String, dynamic>? customer,
}) {
  if (customer == null) return const SizedBox.shrink();
  final billing = ((customer['billing_address'] ?? customer['address'] ?? '') as Object).toString().trim();
  final shipping = ((customer['shipping_address'] ?? '') as Object).toString().trim();
  final gstin = ((customer['gstin'] ?? '') as Object).toString().trim();
  if (billing.isEmpty && shipping.isEmpty && gstin.isEmpty) return const SizedBox.shrink();
  final cs = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return Container(
    margin: const EdgeInsets.only(top: 10),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: cs.surfaceContainer,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: isDark ? cs.outlineVariant : Colors.grey.shade300),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (billing.isNotEmpty) Text('Billing: $billing', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
        if (shipping.isNotEmpty) Text('Shipping: $shipping', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
        if (gstin.isNotEmpty) Text('GSTIN: $gstin', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
      ],
    ),
  );
}

// ─── Totals card helper ───────────────────────────────────────────────────────

/// A single row in the dark totals summary card.
Widget salesTotRow(
  BuildContext context,
  String label,
  double v, {
  bool bold = false,
  bool lightModeSlateTotalsCard = false,
}) {
  final cs    = Theme.of(context).colorScheme;
  if (lightModeSlateTotalsCard) {
    final muted  = Colors.white.withValues(alpha: 0.88);
    final strong = Colors.white;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? strong : muted,
                fontSize: bold ? 15 : 13,
              )),
          Text(v.toStringAsFixed(2),
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                fontSize: bold ? 16 : 13,
                color: bold ? kSalesAccent : Colors.white.withValues(alpha: 0.95),
              )),
        ],
      ),
    );
  }
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: bold ? cs.onSurface : cs.onSurfaceVariant,
              fontSize: bold ? 15 : 13,
            )),
        Text(v.toStringAsFixed(2),
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              fontSize: bold ? 16 : 13,
              color: bold ? kSalesAccent : cs.onSurface,
            )),
      ],
    ),
  );
}

/// Full totals card used at the bottom of all three form views.
Widget salesTotalsCard({
  required BuildContext context,
  required List<dynamic> lines, // List<SalesLineDraft>
  required String gstType,      // 'intra_state' | 'inter_state'
  required String taxType,      // 'exclusive' | 'inclusive' | 'no_tax'
  required TextEditingController discountAmountCtrl,
  required TextEditingController shippingAmountCtrl,
  required TextEditingController roundOffCtrl,
  /// When false, matches web quote/order [TotalSummary] (line totals only).
  bool includeDocumentCharges = true,
}) {
  // Avoid importing SalesLineDraft here — callers pass duck-typed lists.
  // We call .taxableBase(taxType:) and .gstAmount(taxType:) via dynamic dispatch.
  final interstate = gstType == 'inter_state';
  double subtotal = 0, gst = 0;
  for (final L in lines) {
    subtotal += (L as dynamic).taxableBase(taxType: taxType) as double;
    gst      += (L as dynamic).gstAmount(taxType: taxType) as double;
  }
  subtotal = double.parse(subtotal.toStringAsFixed(2));
  gst      = double.parse(gst.toStringAsFixed(2));
  final halfGst   = double.parse((gst / 2).toStringAsFixed(2));
  final discAmt   = includeDocumentCharges ? (double.tryParse(discountAmountCtrl.text) ?? 0) : 0.0;
  final shipAmt   = includeDocumentCharges ? (double.tryParse(shippingAmountCtrl.text) ?? 0) : 0.0;
  final rOffAmt   = includeDocumentCharges ? (double.tryParse(roundOffCtrl.text) ?? 0) : 0.0;
  final grand     = double.parse((subtotal + gst - discAmt + shipAmt + rOffAmt).toStringAsFixed(2));

  final cs     = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;

  return Card(
    color: isDark ? cs.surfaceContainerHigh : kSalesLightAppBarBg,
    elevation: isDark ? 0 : 2,
    shadowColor: isDark ? Colors.transparent : Colors.black26,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.transparent),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          salesTotRow(context, 'Subtotal', subtotal, lightModeSlateTotalsCard: !isDark),
          if (taxType != 'no_tax') ...[
            if (interstate)
              salesTotRow(context, 'IGST', gst, lightModeSlateTotalsCard: !isDark)
            else ...[
              salesTotRow(context, 'CGST', halfGst, lightModeSlateTotalsCard: !isDark),
              salesTotRow(context, 'SGST', halfGst, lightModeSlateTotalsCard: !isDark),
            ],
          ],
          if (discAmt != 0)
            salesTotRow(context, 'Discount', -discAmt, lightModeSlateTotalsCard: !isDark),
          if (shipAmt != 0)
            salesTotRow(context, 'Shipping', shipAmt, lightModeSlateTotalsCard: !isDark),
          if (rOffAmt != 0)
            salesTotRow(context, 'Round off', rOffAmt, lightModeSlateTotalsCard: !isDark),
          Divider(
            height: 16,
            color: isDark ? cs.outlineVariant.withValues(alpha: 0.65) : const Color(0x40FFFFFF),
          ),
          salesTotRow(context, 'Grand total', grand, bold: true, lightModeSlateTotalsCard: !isDark),
        ],
      ),
    ),
  );
}

Color salesDocAppBarBg(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return Theme.of(context).brightness == Brightness.dark ? cs.surfaceContainerHigh : kSalesLightAppBarBg;
}

TextStyle salesFieldSectionLabel(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: Theme.of(context).brightness == Brightness.dark ? cs.onSurface : const Color(0xFF0F172A),
  );
}

TextStyle salesLineItemCaption(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: Theme.of(context).brightness == Brightness.dark ? cs.onSurfaceVariant : const Color(0xFF334155),
  );
}

OutlineInputBorder salesFieldBorder(BuildContext context, {bool focused = false}) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final normal = dark ? cs.outlineVariant : const Color(0xFF94A3B8);
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: focused ? kSalesAccent : normal, width: focused ? 1.6 : 1),
  );
}

InputDecoration salesOutlineField(
  BuildContext context, {
  String? hintText,
  Widget? suffixIcon,
}) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final fill = cs.surfaceContainer;
  final hintFg = dark ? cs.onSurfaceVariant.withValues(alpha: 0.95) : const Color(0xFF334155);
  return InputDecoration(
    hintText: hintText,
    hintStyle: TextStyle(color: hintFg, fontWeight: FontWeight.w500, fontSize: 14),
    filled: true,
    fillColor: fill,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    suffixIcon: suffixIcon,
    border: salesFieldBorder(context),
    enabledBorder: salesFieldBorder(context),
    focusedBorder: salesFieldBorder(context, focused: true),
  );
}

InputDecoration salesCustomerDropdownDecoration(BuildContext context, {required Widget hint}) {
  final cs = Theme.of(context).colorScheme;
  return InputDecoration(
    hint: hint,
    filled: true,
    fillColor: cs.surfaceContainer,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: salesFieldBorder(context),
    enabledBorder: salesFieldBorder(context),
    focusedBorder: salesFieldBorder(context, focused: true),
  );
}

/// Web `Sales.jsx` [LineItems] product `<select>` above the description field.
Widget salesLineProductDropdown({
  required BuildContext context,
  required List<Map<String, dynamic>> products,
  required int? selectedProductId,
  required ValueChanged<int?> onChanged,
}) {
  final cs = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  if (products.isEmpty) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        'No catalog products with available stock — enter lines manually.',
        style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
      ),
    );
  }
  final ids = products.map((e) => (e['id'] as num).toInt()).toSet();
  final safe = selectedProductId != null && ids.contains(selectedProductId) ? selectedProductId : null;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'Product',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
          color: isDark ? cs.onSurfaceVariant : const Color(0xFF334155),
        ),
      ),
      const SizedBox(height: 4),
      DropdownButtonFormField<int?>(
        isExpanded: true,
        value: safe,
        decoration: salesCustomerDropdownDecoration(
          context,
          hint: const Text('— Select product —'),
        ),
        dropdownColor: isDark ? cs.surfaceContainerHighest : null,
        style: TextStyle(color: cs.onSurface, fontSize: 14, fontWeight: FontWeight.w500),
        items: [
          const DropdownMenuItem<int?>(
            value: null,
            child: Text('— Select product —'),
          ),
          ...products.map(
            (p) => DropdownMenuItem<int?>(
              value: (p['id'] as num).toInt(),
              child: Text(
                (p['name'] ?? '—').toString(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
        onChanged: onChanged,
      ),
    ],
  );
}

PreferredSizeWidget salesDocAppBar(
  BuildContext context, {
  required String title,
  String? subtitle,
  required bool showSave,
  required bool isSaving,
  VoidCallback? onSave,
}) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  final cs = Theme.of(context).colorScheme;
  final barInk = dark ? cs.onSurface : Colors.white;
  final sub = subtitle?.trim();
  return AppBar(
    backgroundColor: salesDocAppBarBg(context),
    foregroundColor: barInk,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
    iconTheme: IconThemeData(color: barInk),
    actionsIconTheme: IconThemeData(color: barInk),
    titleTextStyle: TextStyle(color: barInk, fontSize: 18, fontWeight: FontWeight.w600),
    leading: IconButton(
      onPressed: () => Get.back(),
      icon: const Icon(Icons.arrow_back_rounded),
      color: barInk,
    ),
    title: sub == null || sub.isEmpty
        ? Text(title)
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title),
              Text(
                sub,
                style: TextStyle(
                  color: barInk.withValues(alpha: 0.82),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  height: 1.2,
                ),
              ),
            ],
          ),
    actions: [
      if (showSave)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: FilledButton(
            onPressed: isSaving ? null : onSave,
            style: FilledButton.styleFrom(
              backgroundColor: dark ? kSalesAccent : Colors.white,
              foregroundColor: dark ? Colors.white : kSalesLightAppBarBg,
              disabledBackgroundColor: dark ? kSalesAccent.withValues(alpha: 0.35) : Colors.white54,
              disabledForegroundColor: dark ? Colors.white70 : kSalesLightAppBarBg.withValues(alpha: 0.62),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: isSaving
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: dark ? Colors.white : kSalesLightAppBarBg,
                    ),
                  )
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
        ),
    ],
  );
}

/// “Fill from product” bottom sheet — [products] should already list in-stock rows only.
Widget salesProductPickerSheet({
  required BuildContext context,
  required List<Map<String, dynamic>> products,
  required ValueChanged<Map<String, dynamic>> onPick,
}) {
  final sheetCs = Theme.of(context).colorScheme;
  return Material(
    color: sheetCs.surfaceContainerHigh,
    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
    child: SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.55,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                'Pick product (in stock)',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: sheetCs.onSurface),
              ),
            ),
            Expanded(
              child: products.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No products with available stock.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: sheetCs.onSurfaceVariant, fontSize: 14),
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: products.length,
                      itemBuilder: (_, i) {
                        final p = products[i];
                        return ListTile(
                          title: Text((p['name'] ?? '—').toString()),
                          subtitle: Text(productPickerSubtitle(p)),
                          onTap: () => onPick(p),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}
