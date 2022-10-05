// This is the Debian specific preferences file for Mozilla Firefox
// You can make any change in here, it is the purpose of this file.
// You can, with this file and all files present in the
// /etc/firefox/pref directory, override any preference that is
// present in /usr/lib/firefox/defaults/pref directory.
// While your changes will be kept on upgrade if you modify files in
// /etc/firefox/pref, please note that they won't be kept if you
// do them in /usr/lib/firefox/defaults/pref.

pref("extensions.update.enabled", true);

// show bookmark toolbar
pref("browser.showPersonalToolbar", true);

// Use LANG environment variable to choose locale
pref("intl.locale.matchOS", true);
pref("intl.locale.requested", "");

// Disable default browser checking.
pref("browser.shell.checkDefaultBrowser", false);

// Prevent EULA dialog to popup on first run
pref("browser.EULA.override", true);

// identify linuxmint @ yahoo searchplugin
pref("browser.search.param.yahoo-fr", "linuxmint");

// Set the UserAgent
pref("general.useragent.vendor", "HamoniKR");
pref("general.useragent.vendorSub", "5.0");
pref("general.useragent.vendorComment", "Public");

// Default search engine
pref("browser.search.searchEnginesURL", "http://www.linuxmint.com/searchengines/");

// Activate the backspace key for browsing back
pref("browser.backspace_action", 0);

// Ignore Mozilla release notes startup pages
pref("browser.startup.homepage_override.mstone", "ignore");

// Don't interrupt user workflow
pref('datareporting.policy.dataSubmissionPolicyBypassNotification', true);
pref('browser.slowStartup.notificationDisabled', true);
pref('browser.disableResetPrompt', true);
pref("browser.rights.3.shown", true);
pref("toolkit.telemetry.prompted", 2);
pref("toolkit.telemetry.rejected", true);

// identify default locale to use if no /usr/lib/firefox-addons/searchplugins/LOCALE
// exists for the current used LOCALE
pref("distribution.searchplugins.defaultLocale", "ko-KR");

// Enable the NetworkManager integration
//pref("network.manage-offline-status", true);

// Don't disable our bundled extensions in the application directory
pref("extensions.autoDisableScopes", 0);
pref("extensions.shownSelectionUI", true);

// Don't apply the GTK theme to the inner content (this fixes support for Dark themes)
pref("widget.content.gtk-theme-override", "#");

// Map to hyphenation patterns from openoffice.org-hyphenation and openoffice.org-dictionaries
pref("intl.hyphenation-alias.af", "af-za");
pref("intl.hyphenation-alias.af-*", "af-za");
pref("intl.hyphenation-alias.bn", "bn-in");
pref("intl.hyphenation-alias.bn-*", "bn-in");
pref("intl.hyphenation-alias.ca-*", "ca");
pref("intl.hyphenation-alias.cs", "cs-cz");
pref("intl.hyphenation-alias.cs-*", "cs-cz");
pref("intl.hyphenation-alias.da", "da-dk");
pref("intl.hyphenation-alias.da-*", "da-dk");
pref("intl.hyphenation-alias.de", "de-de");
pref("intl.hyphenation-alias.de-*", "de-de");
pref("intl.hyphenation-alias.de-AT-1901", "de-de");
pref("intl.hyphenation-alias.de-CH-*", "de-de");
pref("intl.hyphenation-alias.de-DE-1901", "de-de");
pref("intl.hyphenation-alias.el", "el-gr");
pref("intl.hyphenation-alias.el-*", "el-gr");
pref("intl.hyphenation-alias.en", "en-us");
pref("intl.hyphenation-alias.en-*", "en-us");
pref("intl.hyphenation-alias.es", "es-es");
pref("intl.hyphenation-alias.es-*", "es-es");
pref("intl.hyphenation-alias.et", "et-ee");
pref("intl.hyphenation-alias.et-*", "et-ee");
pref("intl.hyphenation-alias.fi", "fi-fi");
pref("intl.hyphenation-alias.fi-*", "fi-fi");
pref("intl.hyphenation-alias.fr-*", "fr");
pref("intl.hyphenation-alias.ga", "ga-ie");
pref("intl.hyphenation-alias.ga-*", "ga-ie");
pref("intl.hyphenation-alias.gu", "gu-in");
pref("intl.hyphenation-alias.gu-*", "gu-in");
pref("intl.hyphenation-alias.hi", "hi-in");
pref("intl-hyphenation-alias.hi-in", "hi-in");
pref("intl.hyphenation-alias.hr", "hr-hr");
pref("intl.hyphenation-alias.hr-*", "hr-hr");
pref("intl.hyphenation-alias.hu", "hu-hu");
pref("intl.hyphenation-alias.hu-*", "hu-hu");
pref("intl.hyphenation-alias.id", "id-id");
pref("intl-hyphenation-alias.id-*", "id-id");
pref("intl.hyphenation-alias.is", "is-is");
pref("intl.hyphenation-alias.is-*", "is-is");
pref("intl.hyphenation-alias.it", "it-it");
pref("intl.hyphenation-alias.it-*", "it-it");
pref("intl.hyphenation-alias.kn", "kn-in");
pref("intl.hyphenation-alias.kn-*", "kn-in");
pref("intl.hyphenation-alias.lt", "lt-lt");
pref("intl.hyphenation-alias.lt-*", "lt-lt");
pref("intl.hyphenation-alias.lv", "lv-lv");
pref("intl.hyphenation-alias.lv-*", "lv-lv");
pref("intl.hyphenation-alias.nb", "nb-no");
pref("intl.hyphenation-alias.nb-*", "nb-no");
pref("intl.hyphenation-alias.nl", "nl-nl");
pref("intl.hyphenation-alias.nl-*", "nl-nl");
pref("intl.hyphenation-alias.nn", "nn-no");
pref("intl.hyphenation-alias.nn-*", "nn-no");
pref("intl.hyphenation-alias.pa", "pa-in");
pref("intl.hyphenation-alias.pa-*", "pa-in");
pref("intl.hyphenation-alias.pl", "pl-pl");
pref("intl.hyphenation-alias.pl-*", "pl-pl");
pref("intl.hyphenation-alias.pt", "pt-pt");
pref("intl.hyphenation-alias.pt-*", "pt-pt");
pref("intl.hyphenation-alias.ro", "ro-ro");
pref("intl.hyphenation-alias.ro-*", "ro-ro");
pref("intl.hyphenation-alias.ru", "ru-ru");
pref("intl.hyphenation-alias.ru-*", "ru-ru");
pref("intl.hyphenation-alias.sh-*", "sh");
pref("intl.hyphenation-alias.sk", "sk-sk");
pref("intl.hyphenation-alias.sk-*", "sk-sk");
pref("intl.hyphenation-alias.sl", "sl-si");
pref("intl.hyphenation-alias.sl-*", "sl-si");
pref("intl.hyphenation-alias.sr-*", "sr");
pref("intl.hyphenation-alias.sv", "sv-se");
pref("intl.hyphenation-alias.sv-*", "sv-se");
pref("intl.hyphenation-alias.uk", "uk-ua");
pref("intl.hyphenation-alias.uk-*", "uk-ua");
pref("intl.hyphenation-alias.zu", "zu-za");
pref("intl.hyphenation-alias.zu-*", "zu-za");
