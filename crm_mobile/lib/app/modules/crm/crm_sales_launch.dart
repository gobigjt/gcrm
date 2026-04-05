import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/web_app_config.dart';
import '../../routes/app_routes.dart';

/// Bottom sheet: in-app Sales vs optional web Sales with `fromLead` (requires [WebAppConfig]).
Future<void> openCrmSalesOptions(BuildContext context, int leadId) async {
  final webUri = WebAppConfig.salesHandoffUri(leadId);
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
          if (webUri != null)
            ListTile(
              leading: const Icon(Icons.open_in_new_rounded),
              title: const Text('Web Sales (this lead)'),
              subtitle: const Text('Opens browser with customer handoff'),
              onTap: () async {
                Navigator.pop(ctx);
                final ok = await launchUrl(webUri, mode: LaunchMode.externalApplication);
                if (!ok && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Could not open browser')),
                  );
                }
              },
            ),
        ],
      ),
    ),
  );
}
