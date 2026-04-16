import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_routes.dart';

/// Bottom sheet: open in-app Sales (from CRM lead context).
Future<void> openCrmSalesOptions(BuildContext context) async {
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.shopping_bag_outlined),
            title: const Text('Sales in app'),
            onTap: () {
              Navigator.pop(ctx);
              Get.toNamed(AppRoutes.sales);
            },
          ),
        ],
      ),
    ),
  );
}
