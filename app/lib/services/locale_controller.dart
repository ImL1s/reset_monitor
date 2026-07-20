import 'package:flutter/widgets.dart';

import '../l10n/app_localizations.dart';

/// Holds the user's chosen [Locale]. `null` means "follow the device / system
/// language" (the default), so a Japanese phone shows Japanese with no action.
/// Switching is in-session; the device language remains the persistent baseline.
class LocaleController extends ValueNotifier<Locale?> {
  LocaleController([super.value]);
}

/// App-wide singleton. Wired into [MaterialApp.locale] via a listener.
final localeController = LocaleController();

/// Order shown in the language picker. `null` = system default.
/// - `zh`       → Traditional Chinese (product's primary written form)
/// - `zh_Hans`  → Simplified Chinese
const List<Locale?> kPickerLocales = <Locale?>[
  null,
  Locale('en'),
  Locale('zh'),
  Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hans'),
  Locale('ja'),
];

/// Native display name for a picker entry (localized label for the "system"
/// entry, native endonyms for concrete locales so they read in their own script).
String localeLabel(AppL10n l, Locale? locale) {
  if (locale == null) return l.languageSystem;
  switch (locale.languageCode) {
    case 'en':
      return l.langEnglish;
    case 'ja':
      return l.langJa;
    case 'zh':
      return locale.scriptCode == 'Hans' ? l.langZhHans : l.langZhHant;
    default:
      return locale.toLanguageTag();
  }
}

/// True when [a] represents the same picker choice as [b] (script-aware).
bool sameLocaleChoice(Locale? a, Locale? b) {
  if (a == null || b == null) return a == b;
  return a.languageCode == b.languageCode && a.scriptCode == b.scriptCode;
}
