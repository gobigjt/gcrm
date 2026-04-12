import 'package:flutter/material.dart';

/// Preset sizes matching the splash and login screens.
enum CrmSuiteLogoMarkPreset {
  /// Splash screen: larger logo
  splash,

  /// Login screen: smaller logo
  login,
}

/// App logo mark — renders the ez-crm.png asset.
class CrmSuiteLogoMark extends StatelessWidget {
  const CrmSuiteLogoMark({
    super.key,
    required this.size,
    this.preset = CrmSuiteLogoMarkPreset.splash,
    // Kept for API compatibility — not used since we render the real image.
    this.primary = Colors.white,
    this.dimmedOpacity = 0.5,
  });

  final double size;
  final CrmSuiteLogoMarkPreset preset;
  final Color primary;
  final double dimmedOpacity;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        'assets/images/ez_crm_logo.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        alignment: Alignment.center,
        filterQuality: FilterQuality.high,
      ),
    );
  }
}
