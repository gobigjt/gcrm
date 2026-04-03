import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../auth/auth_controller.dart';
import '../../../showcase/showcase_colors.dart';

/// Profile screen aligned with showcase (avatar, role, toggles, sign out).
class ProfileView extends StatefulWidget {
  const ProfileView({super.key});

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  bool pushOn = true;
  bool emailDigest = false;

  @override
  Widget build(BuildContext context) {
    final auth = Get.find<AuthController>();
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: Get.back),
        title: const Text('Profile'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Obx(
            () {
              final name = auth.userName.value;
              final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
              return Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: ShowcaseColors.accentLight,
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: ShowcaseColors.accentDark,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${auth.role.value} · Organization',
                          style: TextStyle(fontSize: 13, color: Theme.of(context).hintColor),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 24),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Push notifications'),
            subtitle: const Text('Lead assignments & task reminders'),
            value: pushOn,
            onChanged: (v) => setState(() => pushOn = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Weekly email digest'),
            value: emailDigest,
            onChanged: (v) => setState(() => emailDigest = v),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: auth.logout,
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
