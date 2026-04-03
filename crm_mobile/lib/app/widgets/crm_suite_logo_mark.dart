import 'package:flutter/material.dart';

/// Preset geometry from documents/EZcrmcrm_mobile_showcase_1.html SVGs.
enum CrmSuiteLogoMarkPreset {
  /// Splash phone: viewBox 30×30, cells 11×11, gap 4, inset 2, rx 2.5
  splash,

  /// Login phone: viewBox 22×22, cells 8×8, gap 2, inset 2, rx 2
  login,
}

/// 2×2 grid mark matching onboarding art in the mobile showcase HTML.
class CrmSuiteLogoMark extends StatelessWidget {
  const CrmSuiteLogoMark({
    super.key,
    required this.size,
    this.preset = CrmSuiteLogoMarkPreset.splash,
    this.primary = Colors.white,
    this.dimmedOpacity = 0.5,
  });

  final double size;
  final CrmSuiteLogoMarkPreset preset;
  final Color primary;
  final double dimmedOpacity;

  @override
  Widget build(BuildContext context) {
    final (vb, inset, cell, gap, rx) = switch (preset) {
      CrmSuiteLogoMarkPreset.splash => (30.0, 2.0, 11.0, 4.0, 2.5),
      CrmSuiteLogoMarkPreset.login => (22.0, 2.0, 8.0, 2.0, 2.0),
    };
    final scale = size / vb;
    final insetPx = inset * scale;
    final cellPx = cell * scale;
    final gapPx = gap * scale;
    final radiusPx = rx * scale;

    return SizedBox(
      width: size,
      height: size,
      child: Padding(
        padding: EdgeInsets.all(insetPx),
        child: Column(
          children: [
            Row(
              children: [
                _cell(cellPx, radiusPx, primary),
                SizedBox(width: gapPx),
                _cell(cellPx, radiusPx, primary.withValues(alpha: dimmedOpacity)),
              ],
            ),
            SizedBox(height: gapPx),
            Row(
              children: [
                _cell(cellPx, radiusPx, primary.withValues(alpha: dimmedOpacity)),
                SizedBox(width: gapPx),
                _cell(cellPx, radiusPx, primary),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _cell(double s, double r, Color color) {
    return Container(
      width: s,
      height: s,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(r),
      ),
    );
  }
}
