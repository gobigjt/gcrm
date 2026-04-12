import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';

import '../../auth/auth_controller.dart';
import '../../../core/network/error_utils.dart';
import '../../../core/utils/media_url.dart';
import '../../../showcase/showcase_colors.dart';

/// Profile screen: avatar (upload), role, toggles, sign out.
class ProfileView extends StatefulWidget {
  const ProfileView({super.key});

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  bool pushOn = true;
  bool emailDigest = false;
  bool _avatarBusy = false;

  Future<void> _pickAndUploadAvatar(AuthController auth) async {
    if (_avatarBusy) return;
    setState(() => _avatarBusy = true);
    try {
      final x = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 88,
      );
      if (x == null) return;
      final bytes = await x.readAsBytes();
      if (bytes.isEmpty) return;
      if (bytes.length > 2 * 1024 * 1024) {
        Get.snackbar('Photo too large', 'Use an image under 2 MB.');
        return;
      }
      var name = x.name;
      if (name.isEmpty) name = 'avatar.jpg';
      await auth.uploadProfileAvatarBytes(bytes, name);
      Get.snackbar('Profile', 'Photo updated');
    } catch (e) {
      Get.snackbar('Upload failed', userFriendlyError(e));
    } finally {
      if (mounted) setState(() => _avatarBusy = false);
    }
  }

  Future<void> _removeAvatar(AuthController auth) async {
    if (_avatarBusy) return;
    setState(() => _avatarBusy = true);
    try {
      await auth.removeProfileAvatar();
      Get.snackbar('Profile', 'Photo removed');
    } catch (e) {
      Get.snackbar('Remove failed', userFriendlyError(e));
    } finally {
      if (mounted) setState(() => _avatarBusy = false);
    }
  }

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
              final url = resolveUploadsPublicUrl(auth.userAvatarUrl.value);
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      CircleAvatar(
                        radius: 36,
                        backgroundColor: ShowcaseColors.accentLight,
                        child: url.isEmpty
                            ? Text(
                                initial,
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                  color: ShowcaseColors.accentDark,
                                ),
                              )
                            : ClipOval(
                                child: Image.network(
                                  url,
                                  key: ValueKey<String>(url),
                                  width: 72,
                                  height: 72,
                                  fit: BoxFit.cover,
                                  gaplessPlayback: true,
                                  errorBuilder: (_, __, ___) => Text(
                                    initial,
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.w800,
                                      color: ShowcaseColors.accentDark,
                                    ),
                                  ),
                                ),
                              ),
                      ),
                      if (_avatarBusy)
                        const SizedBox(
                          width: 72,
                          height: 72,
                          child: Center(
                            child: SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(strokeWidth: 2.5),
                            ),
                          ),
                        ),
                    ],
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
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _avatarBusy ? null : () => _pickAndUploadAvatar(auth),
                              icon: const Icon(Icons.photo_library_outlined, size: 18),
                              label: Text(auth.userAvatarUrl.value.isEmpty ? 'Upload photo' : 'Change photo'),
                            ),
                            if (auth.userAvatarUrl.value.isNotEmpty)
                              TextButton(
                                onPressed: _avatarBusy ? null : () => _removeAvatar(auth),
                                child: const Text('Remove photo'),
                              ),
                          ],
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
