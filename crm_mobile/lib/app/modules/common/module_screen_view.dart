import 'package:flutter/material.dart';

class ModuleScreenView extends StatelessWidget {
  const ModuleScreenView({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          '$title screen',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
      ),
    );
  }
}
