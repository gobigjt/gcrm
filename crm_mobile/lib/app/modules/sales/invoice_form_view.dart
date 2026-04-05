import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/utils/ui_format.dart' show pickDateIntoController;
import '../../shared/widgets/app_error_banner.dart';
import 'invoice_form_controller.dart';
import 'sales_document_form_ui.dart';

class InvoiceFormView extends StatefulWidget {
  const InvoiceFormView({super.key, this.initialCustomerId});

  final int? initialCustomerId;

  @override
  State<InvoiceFormView> createState() => _InvoiceFormViewState();
}

class _InvoiceFormViewState extends State<InvoiceFormView> {
  late final String _tag;
  late final InvoiceFormController c;

  @override
  void initState() {
    super.initState();
    _tag = 'invf_${identityHashCode(this)}';
    c = Get.put(InvoiceFormController(initialCustomerId: widget.initialCustomerId), tag: _tag);
  }

  @override
  void dispose() {
    Get.delete<InvoiceFormController>(tag: _tag);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const title = 'New Invoice';
    final pageBg = Theme.of(context).scaffoldBackgroundColor;

    return Obx(() {
      if (c.isLoading.value) {
        return Scaffold(
          backgroundColor: pageBg,
          appBar: salesDocAppBar(context, title: title, showSave: false, isSaving: false, onSave: null),
          body: Center(
            child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
          ),
        );
      }

      return Scaffold(
        backgroundColor: pageBg,
        appBar: salesDocAppBar(
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
                  Text('Customer', style: salesFieldSectionLabel(context)),
                  const SizedBox(height: 6),
                  Obx(() {
                    final cur = c.selectedCustomerId.value;
                    final ids = c.customers.map((cu) => (cu['id'] as num).toInt()).toSet();
                    final safeVal = cur != null && ids.contains(cur) ? cur : null;
                    return DropdownButtonFormField<int>(
                      value: safeVal,
                      decoration: salesCustomerDropdownDecoration(
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
                  Text('Invoice date', style: salesFieldSectionLabel(context)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: c.invoiceDateCtrl,
                    readOnly: true,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                    decoration: salesOutlineField(
                      context,
                      hintText: 'Tap calendar to pick a date',
                      suffixIcon: IconButton(
                        icon: Icon(
                          Icons.calendar_today_rounded,
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Theme.of(context).colorScheme.onSurfaceVariant
                              : Colors.grey.shade700,
                        ),
                        onPressed: () => pickDateIntoController(context: context, controller: c.invoiceDateCtrl),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('Due date', style: salesFieldSectionLabel(context)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: c.dueDateCtrl,
                    readOnly: true,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                    decoration: salesOutlineField(
                      context,
                      hintText: 'Tap calendar to pick a date',
                      suffixIcon: IconButton(
                        icon: Icon(
                          Icons.event_rounded,
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Theme.of(context).colorScheme.onSurfaceVariant
                              : Colors.grey.shade700,
                        ),
                        onPressed: () => pickDateIntoController(context: context, controller: c.dueDateCtrl),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Obx(() {
                    final cs = Theme.of(context).colorScheme;
                    final isDark = Theme.of(context).brightness == Brightness.dark;
                    return Card(
                      margin: EdgeInsets.zero,
                      color: isDark ? cs.surfaceContainer : Colors.white,
                      elevation: isDark ? 0 : 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isDark ? cs.outlineVariant : Colors.grey.shade300),
                      ),
                      child: SwitchListTile(
                        title: Text(
                          'Interstate supply (IGST instead of CGST+SGST)',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: cs.onSurface,
                          ),
                        ),
                        value: c.isInterstate.value,
                        onChanged: (v) {
                          c.isInterstate.value = v;
                          c.lines.refresh();
                        },
                      ),
                    );
                  }),
                  const SizedBox(height: 12),
                  Text('Notes', style: salesFieldSectionLabel(context)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: c.notesCtrl,
                    maxLines: 3,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                    decoration: salesOutlineField(context, hintText: 'Optional notes for this invoice'),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Text('Products', style: salesFieldSectionLabel(context)),
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
                                          Text('Description', style: salesLineItemCaption(context)),
                                          const SizedBox(height: 4),
                                          TextField(
                                            controller: line.descCtrl,
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                            decoration: salesOutlineField(context, hintText: 'Product or description'),
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
                                      onPressed: () => _pickProduct(context, i),
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
                                          Text('Qty', style: salesLineItemCaption(context)),
                                          const SizedBox(height: 4),
                                          TextField(
                                            controller: line.qtyCtrl,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                            decoration: salesOutlineField(context, hintText: '1'),
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
                                          Text('Unit price', style: salesLineItemCaption(context)),
                                          const SizedBox(height: 4),
                                          TextField(
                                            controller: line.unitCtrl,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                            decoration: salesOutlineField(context, hintText: '0.00'),
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
                                          Text('GST %', style: salesLineItemCaption(context)),
                                          const SizedBox(height: 4),
                                          TextField(
                                            controller: line.gstCtrl,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 15),
                                            decoration: salesOutlineField(context, hintText: '0'),
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
                      color: kSalesAccent,
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
                    double sub = 0;
                    double tax = 0;
                    for (final L in c.lines) {
                      sub += L.taxableBase();
                      tax += L.gstAmount();
                    }
                    sub = double.parse(sub.toStringAsFixed(2));
                    tax = double.parse(tax.toStringAsFixed(2));
                    final interstate = c.isInterstate.value;
                    final halfTax = double.parse((tax / 2).toStringAsFixed(2));
                    final grand = double.parse((sub + tax).toStringAsFixed(2));
                    final cs = Theme.of(context).colorScheme;
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
                            _totRow(context, 'Taxable value', sub, lightModeSlateTotalsCard: !isDark),
                            if (interstate)
                              _totRow(context, 'IGST', tax, lightModeSlateTotalsCard: !isDark)
                            else ...[
                              _totRow(context, 'CGST', halfTax, lightModeSlateTotalsCard: !isDark),
                              _totRow(context, 'SGST', halfTax, lightModeSlateTotalsCard: !isDark),
                            ],
                            Divider(height: 20, color: isDark ? cs.outlineVariant.withValues(alpha: 0.65) : const Color(0x40FFFFFF)),
                            _totRow(context, 'Grand total', grand, bold: true, lightModeSlateTotalsCard: !isDark),
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
                        backgroundColor: kSalesAccent,
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
                          : const Text(
                              'Create invoice',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
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
                color: bold ? kSalesAccent : Colors.white.withValues(alpha: 0.95),
              ),
            ),
          ],
        ),
      );
    }
    final labelColor = bold ? cs.onSurface : cs.onSurfaceVariant;
    final valueColor = bold ? kSalesAccent : cs.onSurface;
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

  Future<void> _pickProduct(BuildContext context, int lineIndex) async {
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
