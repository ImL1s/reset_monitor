import 'package:flutter_test/flutter_test.dart';
import 'package:reset_radar/main.dart';

void main() {
  testWidgets('RESET Radar shell shows title', (tester) async {
    await tester.pumpWidget(const ResetRadarApp());
    await tester.pump();
    // App bar + nav may show RESET Radar / Board without waiting API
    expect(find.textContaining('RESET Radar'), findsWidgets);
    expect(find.text('Board'), findsOneWidget);
  });
}
