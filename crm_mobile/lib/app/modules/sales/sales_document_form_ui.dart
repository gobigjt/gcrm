import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// Shared chrome for quotation / order / invoice forms (matches `QuotationFormView`).
const Color kSalesAccent = Color(0xFF26A69A);
const Color kSalesLightAppBarBg = Color(0xFF263238);

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
  final hintFg = dark ? cs.onSurfaceVariant.withValues(alpha: 0.92) : const Color(0xFF64748B);
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

PreferredSizeWidget salesDocAppBar(
  BuildContext context, {
  required String title,
  required bool showSave,
  required bool isSaving,
  VoidCallback? onSave,
}) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  final cs = Theme.of(context).colorScheme;
  final barInk = dark ? cs.onSurface : Colors.white;
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
    title: Text(title),
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
              disabledForegroundColor: dark ? Colors.white54 : kSalesLightAppBarBg.withValues(alpha: 0.5),
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
