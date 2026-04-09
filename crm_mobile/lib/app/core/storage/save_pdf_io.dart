import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

Future<void> savePdfDownload({required String fileName, required List<int> bytes}) async {
  final dir = await getTemporaryDirectory();
  final path = '${dir.path}/$fileName';
  final f = File(path);
  await f.writeAsBytes(bytes, flush: true);
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(path)],
      subject: fileName,
    ),
  );
}
