import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/models/inventory_models.dart';
import '../../../shared/widgets/app_error_banner.dart';
import '../../../showcase/showcase_widgets.dart';
import '../../inventory/inventory_controller.dart';

/// Stock adjustment (POST /inventory/stock/adjust).
class StockAdjustView extends StatefulWidget {
  const StockAdjustView({super.key});

  @override
  State<StockAdjustView> createState() => _StockAdjustViewState();
}

class _StockAdjustViewState extends State<StockAdjustView> {
  final _qtyCtrl = TextEditingController(text: '1');
  final _noteCtrl = TextEditingController();
  String _type = 'in';
  InventoryProduct? _product;
  InventoryWarehouse? _warehouse;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inv = Get.find<InventoryController>();
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: Get.back),
        title: const Text('Stock adjustment'),
        actions: [
          IconButton(onPressed: inv.loadAll, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: Obx(() {
        if (inv.isLoading.value && inv.products.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }
        final products = inv.products.where((p) => p.id != null).toList();
        final whs = inv.warehouses.where((w) => w.id != null).toList();

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Obx(
              () => AppErrorBanner(
                message: inv.errorMessage.value,
                onRetry: inv.loadAll,
              ),
            ),
            if (products.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(
                  'No products loaded. Open full inventory or pull to refresh from the home screen.',
                  style: TextStyle(color: Theme.of(context).hintColor),
                ),
              ),
            const ShowcaseSectionTitle('Movement'),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'in', label: Text('Stock in'), icon: Icon(Icons.add_circle_outline_rounded)),
                ButtonSegment(value: 'out', label: Text('Stock out'), icon: Icon(Icons.remove_circle_outline_rounded)),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() => _type = s.first),
            ),
            const SizedBox(height: 16),
            const ShowcaseSectionTitle('Product'),
            DropdownButtonFormField<InventoryProduct>(
              value: _product != null && products.contains(_product) ? _product : null,
              hint: const Text('Select product'),
              isExpanded: true,
              items: products
                  .map(
                    (p) => DropdownMenuItem(
                      value: p,
                      child: Text(p.name, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (p) => setState(() => _product = p),
            ),
            const SizedBox(height: 16),
            const ShowcaseSectionTitle('Warehouse'),
            DropdownButtonFormField<InventoryWarehouse>(
              value: _warehouse != null && whs.contains(_warehouse) ? _warehouse : null,
              hint: const Text('Select warehouse'),
              isExpanded: true,
              items: whs
                  .map(
                    (w) => DropdownMenuItem(
                      value: w,
                      child: Text('${w.name} (${w.location})', overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (w) => setState(() => _warehouse = w),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _qtyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Quantity',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtrl,
              decoration: const InputDecoration(
                labelText: 'Note (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            Obx(
              () => FilledButton(
                onPressed: inv.isSubmitting.value
                    ? null
                    : () async {
                        final pid = _product?.id;
                        final wid = _warehouse?.id;
                        if (pid == null || wid == null) {
                          Get.snackbar('Missing', 'Choose product and warehouse.');
                          return;
                        }
                        final q = num.tryParse(_qtyCtrl.text.trim());
                        if (q == null || q <= 0) {
                          Get.snackbar('Invalid', 'Enter a positive quantity.');
                          return;
                        }
                        await inv.adjustStock(
                          productId: pid,
                          warehouseId: wid,
                          type: _type,
                          quantity: q,
                          note: _noteCtrl.text.trim(),
                        );
                        if (!mounted) return;
                        setState(() {
                          _noteCtrl.clear();
                          _qtyCtrl.text = '1';
                        });
                        Get.snackbar('Saved', 'Stock adjustment recorded.');
                      },
                child: inv.isSubmitting.value
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save adjustment'),
              ),
            ),
          ],
        );
      }),
    );
  }
}
