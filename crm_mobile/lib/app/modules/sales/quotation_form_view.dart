import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart' show pickDateIntoController;
import '../../shared/widgets/app_error_banner.dart';
import 'quotation_form_controller.dart';

const Color _accent = Color(0xFF26A69A);
/// Light-mode app bar only (matches Sales); dark uses [ColorScheme.surfaceContainerHigh].
const Color _lightAppBarBg = Color(0xFF263238);

Color _quotationAppBarBg(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return Theme.of(context).brightness == Brightness.dark ? cs.surfaceContainerHigh : _lightAppBarBg;
}

TextStyle _fieldSectionLabel(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: Theme.of(context).brightness == Brightness.dark ? cs.onSurface : const Color(0xFF0F172A),
  );
}

TextStyle _lineItemCaption(BuildContext context) {
  final cs = Theme.of(context).colorScheme;
  return TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: Theme.of(context).brightness == Brightness.dark ? cs.onSurfaceVariant : const Color(0xFF334155),
  );
}

OutlineInputBorder _quotationFieldBorder(BuildContext context, {bool focused = false}) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final normal = dark ? cs.outlineVariant : const Color(0xFF94A3B8);
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: focused ? _accent : normal, width: focused ? 1.6 : 1),
  );
}

/// Outlined field **without** `labelText` — floating labels often disappear on web after theme merge.
InputDecoration _outlineField(
  BuildContext context, {
  String? hintText,
  Widget? suffixIcon,
}) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final fill = dark ? cs.surfaceContainer : Colors.white;
  final hintFg = dark ? cs.onSurfaceVariant.withValues(alpha: 0.92) : const Color(0xFF64748B);
  return InputDecoration(
    hintText: hintText,
    hintStyle: TextStyle(color: hintFg, fontWeight: FontWeight.w500, fontSize: 14),
    filled: true,
    fillColor: fill,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    suffixIcon: suffixIcon,
    border: _quotationFieldBorder(context),
    enabledBorder: _quotationFieldBorder(context),
    focusedBorder: _quotationFieldBorder(context, focused: true),
  );
}

InputDecoration _customerDropdownDecoration(BuildContext context, {required Widget hint}) {
  final cs = Theme.of(context).colorScheme;
  final dark = Theme.of(context).brightness == Brightness.dark;
  return InputDecoration(
    hint: hint,
    filled: true,
    fillColor: dark ? cs.surfaceContainer : Colors.white,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    border: _quotationFieldBorder(context),
    enabledBorder: _quotationFieldBorder(context),
    focusedBorder: _quotationFieldBorder(context, focused: true),
  );
}

PreferredSizeWidget _quotationAppBar(
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
    backgroundColor: _quotationAppBarBg(context),
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
              backgroundColor: dark ? _accent : Colors.white,
              foregroundColor: dark ? Colors.white : _lightAppBarBg,
              disabledBackgroundColor: dark ? _accent.withValues(alpha: 0.35) : Colors.white54,
              disabledForegroundColor: dark ? Colors.white54 : _lightAppBarBg.withValues(alpha: 0.5),
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
                      color: dark ? Colors.white : _lightAppBarBg,
                    ),
                  )
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
        ),
    ],
  );
}

class QuotationFormView extends StatefulWidget {
  const QuotationFormView({super.key, this.quotationId, this.copyFromId});

  final int? quotationId;
  final int? copyFromId;

  @override
  State<QuotationFormView> createState() => _QuotationFormViewState();
}

class _QuotationFormViewState extends State<QuotationFormView> {
  late final String _tag;
  late final QuotationFormController c;

  @override
  void initState() {
    super.initState();
    _tag = 'qf_${identityHashCode(this)}';
    c = Get.put(
      QuotationFormController(quotationId: widget.quotationId, copyFromId: widget.copyFromId),
      tag: _tag,
    );
  }

  @override
  void dispose() {
    Get.delete<QuotationFormController>(tag: _tag);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.quotationId != null && widget.quotationId! > 0;
    final title = isEdit ? 'Edit Quotation' : 'New Quotation';

    final pageBg = Theme.of(context).scaffoldBackgroundColor;

    return Obx(() {
      if (c.isLoading.value) {
        return Scaffold(
          backgroundColor: pageBg,
          appBar: _quotationAppBar(context, title: title, showSave: false, isSaving: false, onSave: null),
          body: Center(
            child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
          ),
        );
      }

      return Scaffold(
        backgroundColor: pageBg,
        appBar: _quotationAppBar(
          context,
          title: title,
          showSave: true,
          isSaving: c.isSaving.value,
          onSave: c.isSaving.value ? null : c.submit,
        ),
        body: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
                children: [
            if (c.errorMessage.value.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppErrorBanner(
                  message: c.errorMessage.value,
                  onRetry: c.retry,
                ),
              ),
            Obx(() {
              String? name;
              final sid = c.selectedCustomerId.value;
              if (sid != null) {
                for (final cu in c.customers) {
                  if ((cu['id'] as num?)?.toInt() == sid) {
                    name = (cu['name'] ?? '').toString();
                    break;
                  }
                }
              }
              final hint = (name == null || name.isEmpty) ? 'Select customer' : 'for M/s.$name';
              final cs = Theme.of(context).colorScheme;
              return Text(
                hint,
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.dark ? cs.onSurfaceVariant : Colors.grey.shade900,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              );
            }),
            const SizedBox(height: 12),
            Text('Customer', style: _fieldSectionLabel(context)),
            const SizedBox(height: 6),
            Obx(() {
              final cur = c.selectedCustomerId.value;
              final ids = c.customers.map((cu) => (cu['id'] as num).toInt()).toSet();
              final safeVal = cur != null && ids.contains(cur) ? cur : null;
              return DropdownButtonFormField<int>(
                value: safeVal,
                decoration: _customerDropdownDecoration(
                  context,
                  hint: Text(
                    'Choose customer',
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? Theme.of(context).colorScheme.onSurfaceVariant
                          : const Color(0xFF475569),
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                dropdownColor: Theme.of(context).brightness == Brightness.dark
                    ? Theme.of(context).colorScheme.surfaceContainerHighest
                    : null,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
                items: c.customers
                    .map(
                      (cu) => DropdownMenuItem<int>(
                        value: (cu['id'] as num).toInt(),
                        child: Text((cu['name'] ?? '—').toString(), overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: (v) => c.selectedCustomerId.value = v,
              );
            }),
            const SizedBox(height: 12),
            Text('Valid until', style: _fieldSectionLabel(context)),
            const SizedBox(height: 6),
            TextField(
              controller: c.validUntilCtrl,
              readOnly: true,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
              decoration: _outlineField(
                context,
                hintText: 'Tap calendar to pick a date',
                suffixIcon: IconButton(
                  icon: Icon(
                    Icons.calendar_today_rounded,
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Theme.of(context).colorScheme.onSurfaceVariant
                        : Colors.grey.shade700,
                  ),
                  onPressed: () => pickDateIntoController(context: context, controller: c.validUntilCtrl),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text('Notes', style: _fieldSectionLabel(context)),
            const SizedBox(height: 6),
            TextField(
              controller: c.notesCtrl,
              maxLines: 3,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
              decoration: _outlineField(context, hintText: 'Optional notes for this quotation'),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Text('Products', style: _fieldSectionLabel(context)),
                const Spacer(),
                Text(
                  'Unit Price × Qty · Amount (INR)',
                  style: TextStyle(
                    fontSize: 11,
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Theme.of(context).colorScheme.onSurfaceVariant
                        : Colors.grey.shade800,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Obx(() {
              return Column(
                children: List.generate(c.lines.length, (i) {
                  final line = c.lines[i];
                  final cs = Theme.of(context).colorScheme;
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    color: isDark ? cs.surfaceContainer : Colors.white,
                    elevation: isDark ? 0 : 1.5,
                    shadowColor: isDark ? Colors.transparent : Colors.black26,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade300),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text('Description', style: _lineItemCaption(context)),
                                    const SizedBox(height: 4),
                                    TextField(
                                      controller: line.descCtrl,
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                      decoration: _outlineField(context, hintText: 'Product or description'),
                                      onChanged: (_) => c.lines.refresh(),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => c.removeLineAt(i),
                                icon: const Icon(Icons.delete_outline, color: Color(0xFFE53935)),
                              ),
                            ],
                          ),
                          if (c.products.isNotEmpty)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton.icon(
                                onPressed: () => _pickProduct(context, c, i),
                                icon: const Icon(Icons.inventory_2_outlined, size: 18),
                                label: const Text('Fill from product'),
                              ),
                            ),
                          const SizedBox(height: 8),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text('Qty', style: _lineItemCaption(context)),
                                    const SizedBox(height: 4),
                                    TextField(
                                      controller: line.qtyCtrl,
                                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                      decoration: _outlineField(context, hintText: '1'),
                                      onChanged: (_) => c.lines.refresh(),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text('Unit price', style: _lineItemCaption(context)),
                                    const SizedBox(height: 4),
                                    TextField(
                                      controller: line.unitCtrl,
                                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                      decoration: _outlineField(context, hintText: '0.00'),
                                      onChanged: (_) => c.lines.refresh(),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text('GST %', style: _lineItemCaption(context)),
                                    const SizedBox(height: 4),
                                    TextField(
                                      controller: line.gstCtrl,
                                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                      decoration: _outlineField(context, hintText: '0'),
                                      onChanged: (_) => c.lines.refresh(),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Line total: ${line.computedTotal().toStringAsFixed(2)}',
                            textAlign: TextAlign.right,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF26A69A)),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              );
            }),
            Center(
              child: Material(
                color: _accent,
                shape: const CircleBorder(),
                elevation: 2,
                shadowColor: Colors.black38,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: c.addLine,
                  child: const Padding(
                    padding: EdgeInsets.all(14),
                    child: Icon(Icons.add, color: Colors.white, size: 28),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Obx(() {
              double sum = 0;
              for (final L in c.lines) {
                sum += L.computedTotal();
              }
              final cs = Theme.of(context).colorScheme;
              final isDark = Theme.of(context).brightness == Brightness.dark;
              return Card(
                color: isDark ? cs.surfaceContainerHigh : _lightAppBarBg,
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
                      _totRow(context, 'Sub total', sum, lightModeSlateTotalsCard: !isDark),
                      _totRow(context, 'Net total', sum, lightModeSlateTotalsCard: !isDark),
                      Divider(height: 20, color: isDark ? cs.outlineVariant.withValues(alpha: 0.65) : const Color(0x40FFFFFF)),
                      _totRow(context, 'Grand total', sum, bold: true, lightModeSlateTotalsCard: !isDark),
                    ],
                  ),
                ),
              );
            }),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Material(
                elevation: Theme.of(context).brightness == Brightness.dark ? 8 : 6,
                shadowColor: Colors.black38,
                color: Theme.of(context).brightness == Brightness.dark
                    ? Theme.of(context).colorScheme.surfaceContainer
                    : Colors.white,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: c.isSaving.value ? null : c.submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: _accent,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Theme.of(context).brightness == Brightness.dark
                            ? Colors.grey.shade800
                            : Colors.grey.shade400,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: c.isSaving.value
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : Text(
                              isEdit ? 'Save quotation' : 'Create quotation',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  Widget _totRow(BuildContext context, String label, double v, {bool bold = false, bool lightModeSlateTotalsCard = false}) {
    final cs = Theme.of(context).colorScheme;
    if (lightModeSlateTotalsCard) {
      final muted = Colors.white.withValues(alpha: 0.88);
      final strong = Colors.white;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? strong : muted,
                fontSize: bold ? 15 : 14,
              ),
            ),
            Text(
              v.toStringAsFixed(2),
              style: TextStyle(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                fontSize: bold ? 16 : 14,
                color: bold ? _accent : Colors.white.withValues(alpha: 0.95),
              ),
            ),
          ],
        ),
      );
    }
    final labelColor = bold ? cs.onSurface : cs.onSurfaceVariant;
    final valueColor = bold ? _accent : cs.onSurface;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: labelColor,
              fontSize: bold ? 15 : 14,
            ),
          ),
          Text(
            v.toStringAsFixed(2),
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              fontSize: bold ? 16 : 14,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickProduct(BuildContext context, QuotationFormController c, int lineIndex) async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final sheetCs = Theme.of(ctx).colorScheme;
        return Material(
          color: sheetCs.surfaceContainerHigh,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: SafeArea(
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * 0.55,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'Pick product',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: sheetCs.onSurface,
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      itemCount: c.products.length,
                      itemBuilder: (_, i) {
                        final p = c.products[i];
                        return ListTile(
                          title: Text((p['name'] ?? '—').toString()),
                          subtitle: Text('Sale ${p['sale_price'] ?? '—'} · GST ${p['gst_rate'] ?? 0}%'),
                          onTap: () => Navigator.pop(ctx, p),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    if (picked != null) c.applyProductToLine(lineIndex, picked);
  }
}
