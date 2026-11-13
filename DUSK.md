# Dusk: mobile App und iPhone-Build

## Schneller Songstart (13. November 2026)

Neue iPhone-HLS-Titel können über `DuskStreamPlugin` bereits nach dem Laden der Playlist und erster Audiosegmente abspielen. Der vorhandene HTML-Player, Queue, MediaSession und Unterbrechungsbehandlung bleiben zuständig. Bereits gespeicherte Titel werden zuerst aus dem lokalen Cache geladen. Android, Desktop, Quellen ohne HLS und explizite Wiederholungen verwenden den bisherigen Downloadweg.

Der native Proxy hört ausschließlich auf Loopback. Seine zufälligen Session-/Ressourcenkennungen verweisen auf HTTPS-Medien unter `googlevideo.com`, `sndcdn.com` und `media-streaming.soundcloud.cloud`; er erhält die vom Resolver benötigten HTTP-Header und verweigert verschlüsselte Playlists. Audiosegmente werden zwischen dem Player und dem Offline-Downloader geteilt. Nach drei Sekunden tatsächlicher Wiedergabe beginnt die vollständige Offline-Sicherung; ein schneller Skip davor löst keinen zusätzlichen Gesamtdownload aus. Teilweise geladene Titel werden nicht als offline verfügbar gemeldet.

`mobile/stream-playback.js` koordiniert lokalen Cache, native Vorbereitung, Abbruch und Session-Lebensdauer. Fehler beim Vorbereiten oder Abspielen fallen auf den bestehenden Downloadweg zurück. Bei einem Fehler während der Wiedergabe wird die Abspielposition nach dem Rückfall wiederhergestellt. Native Sessions sind auf vier begrenzt; ihr gemeinsam genutzter Segmentcache auf 32 MiB.

Die Node-Regressionstests stehen in `test/stream-playback.test.js`. `tools/test-dusk-stream.swift` prüft auf dem Mac die Playlistumschreibung, HTTP-Anfragen und einen echten Loopback-Stream mit einer simulierten Medienquelle. Der iPhone-Build führt diese Swift-Tests und die 38 relevanten Node-Tests vor Xcode aus. Lokal bestehen alle 38 Tests; die vollständige Windows-Suite hat 329 bestandene, zwei übersprungene und dieselben vier bereits vor dieser Änderung fehlgeschlagenen Tests. Die wahrgenommene Startzeit, Hintergrundwiedergabe, Seeking und Cache-Wiederverwendung müssen anschließend auf dem iPhone geprüft werden.

Stand: 10. November 2026. Technische Basis bleibt Muriel 1.3.10 (MIT). Zielgerät ist ein iPhone 14; iOS 27 / 27.2 ist die vom Nutzer gemeldete Version. Eine unsignierte IPA wurde auf dem GitHub-Mac-Runner gebaut und strukturell geprüft. Ein echtes iPhone wurde noch nicht getestet.

## Implementiert

- Deutsch und Englisch mit automatischer Auswahl nach der ersten unterstützten Gerätesprache, englischem Fallback und manueller Auswahl pro Profil.
- iOS übergibt `Locale.preferredLanguages` vor dem ersten Web-Paint. `CFBundleLocalizations` enthält `de` und `en`. Im Browser werden `navigator.languages`, Sprachwechsel und die Rückkehr in den Vordergrund berücksichtigt. Eine Änderung der nativen App-Sprache muss noch auf dem Gerät geprüft werden.
- Die UI-Texte liegen im App-Bundle. Die deutsche Grundübersetzung der übernommenen Oberfläche wurde maschinell vorbereitet; die Dusk-Funktionen und zentrale Navigation wurden redaktionell korrigiert. Selten verwendete Alttexte benötigen noch eine vollständige sprachliche Abnahme. Unbekannte Texte bleiben englisch, ohne zur Laufzeit einen Übersetzungsdienst anzufragen. Musiktitel, Künstler und eigene Namen werden nicht übersetzt.
- Zurückhaltendes Horizontzeichen und Dusk-Schriftzug, neues iOS-App-Icon und neue Startbilder. iOS-Systemschrift ist die neue Standardeinstellung. Bestehende Schriftpräferenzen bleiben erhalten.
- Graphite, Obsidian, Cobalt, Violet, Ember und Ice. Dusk-Themes verwenden feste Farben ohne dekorative Licht- und Glow-Effekte.
- Editor mit Vorschau, sechs Farben, Schriftgröße 80–150 %, Rundungen 0–32 px und drei Gruppen sichtbarer Startseiteninhalte. Änderungen gelten erst nach dem Speichern. Bis zu 24 eigene Themes, Import/Export als JSON, Löschen mit Rückgängig und Zurücksetzen der Darstellung.
- Theme-Dateien werden versionsbezogen validiert. Keine Ausführung von CSS oder Skripten aus einem Dusk-Theme; Textkontrast mindestens 4,5:1 auf allen Flächen, Akzent mindestens 3:1.
- Einstellungen sind durchsuchbar, inklusive der sechs Theme-Namen. Die erweiterte Muriel-Darstellung bleibt über „Dusk-Themes verwenden“ erreichbar. Audio-, Bibliotheks- und Download-Logik wurden nicht verändert.

## Struktur

`i18n.js` verwaltet Sprache und DOM-Übersetzung; `dusk-locales.js` wird offline aus `locales/de.json` und `locales/de-reviewed.json` erzeugt. `dusk-theme-core.js` enthält Schema, Validierung und Presets ohne DOM-Abhängigkeit. `dusk-themes.js` verwaltet Profilzustand, Vorschau und die Anbindung an bestehende Bedienelemente. `dusk.css` enthält das Erscheinungsbild. Der mobile Build kopiert alle Module nach `www/`.

`dusk_themes_v1` wird durch die vorhandene Profilverwaltung getrennt gespeichert. Die bestehenden allgemeinen Muriel-Backup- und Sync-Filter übernehmen diesen neuen Schlüssel noch nicht. Für den Transfer eigener Themes steht der geprüfte Theme-Export zur Verfügung. Die iOS-Bundle-ID lautet jetzt `io.github.zxypablo11.dusk`. Die alten Upstream-Workflows liegen zur Dokumentation unter `.github/upstream-workflows/` und werden nicht ausgeführt. Desktop-Update- und Release-Metadaten bleiben Upstream; für Dusk ausschließlich den dedizierten iOS-Workflow verwenden.

Es wurden keine App-Abhängigkeiten ergänzt. Die vorhandenen Abhängigkeiten wurden aus `package-lock.json` installiert. Ursprünglich geänderte Dateien liegen zusätzlich unter `/tmp/dusk-before-20261110`; dies ist eine temporäre Arbeitskopie, kein dauerhafter Ersatz für Versionsverwaltung.

## Lokal prüfen

```sh
node tools/build-locales.mjs
node mobile/build.mjs
node mobile/dev-server.mjs
```

Danach `http://127.0.0.1:5173` öffnen. In Einstellungen → Oberfläche zwischen Systemsprache, Deutsch und English wechseln. Unter Themes einen Preset wählen, ein eigenes Theme speichern, neu laden und exportieren/importieren. Ungültige Theme-Dateien werden mit einer Fehlermeldung abgelehnt. Beim Zurücksetzen bleiben Musik und gespeicherte Themes erhalten.

```sh
node --test test/dusk-preferences.test.js test/i18n.test.js test/profiles-core.test.js test/library-import.test.js
```

Ergebnis: 32 Tests bestanden. Geprüft sind u. a. Offline-Sprachwahl, manuelle Priorität, Native-Locale-Priorität, volle Speicherung, Platzhalter, Profilzuordnung, Kontraste, beschädigte und ausführbare Importwerte, Sammlungslimit und Wiederherstellung.

Browserprüfung: Deutsch/Englisch/System, Theme-Auswahl, Speichern und Neuladen, Rücksetzen, Suche nach Cobalt, Dateiexport und erneuter Import. Auf 375 px Breite mit 150 % Schriftgröße kein horizontaler Dokumentüberlauf. Theme-Editor im Querformat 844 × 390: Dialog 366 px hoch, Speichern innerhalb des sichtbaren Bereichs. 390 × 844 wurde visuell geprüft. Browserprüfungen ersetzen keine Prüfung mit VoiceOver, Dynamic Type, iOS-Dateifreigabe, Tastatur, Notch und Audio im Hintergrund auf dem echten Gerät.

Die vollständige Testsuite nach GUI-Integration besteht: **317 bestanden, 0 fehlgeschlagen, 1 übersprungen** (318 insgesamt). Der SoundCloud-Test isoliert jetzt auch `yt-fast.lookup`, sodass er keine echte YouTube-Verbindung mehr verwendet. Der Produktions-Extractor wurde dafür nicht verändert.

## Mobile GUI (integriert)

`mobile/dusk-mobile.js` und `mobile/dusk-mobile.css` bilden die separate mobile Oberfläche. `MurielCore` stellt gezielte Adapter für Navigation, Home-Daten, Download-Dialog und Titelmenü bereit. `muriel:view`, `muriel:home` und `muriel:drawer` verbinden die Schichten ohne Polling. Es bleibt genau ein Audioelement mit dem bestehenden Player, Cache und Bibliotheksmodell. Gleichzeitige Trending-Anfragen werden zusammengefasst.

- Entdecken mit echter Empfehlungskarte, Verlauf, Künstlern sowie Filtern für aktuelle Titel und persönliche Mixes; Leerzustände und Wiederholen bei Ladefehlern.
- Sammlung mit Favoriten, Downloads/Dateien, Alben, Künstlern, Verlauf und Playlist-Erstellung.
- Suche mit Quellenwahl und bestehenden Titel-/Album-/Künstler-Ergebnissen.
- Großer Player mit Cover, Favorit, Downloadzugang, bedienbarer Zeitleiste, Transport, Lyrics und Warteschlange. Lokale Titel sind als offline verfügbar markiert. Ladefehler bleiben im Player sichtbar. Fokus wird beim Öffnen und Schließen geführt; der Hintergrund ist währenddessen inert.
- Einstellungsübersicht mit Sprache/Oberfläche, Darstellung, Wiedergabe/Sammlung, Speicher, Profilen, Sync und weiteren Einstellungen. Zwei Spalten für die Theme-Galerie. Ersetzte Desktop-Layoutregler werden ausgeblendet.

Browserprüfung mit 390 × 844, 375 × 812 bei 150 % Schrift und Player bei 844 × 390. Import eines selbst erzeugten 30-Sekunden-Testsignals, Wiedergabe nach Neustart, Pause, Tastatur-Spulen, Favorit, Warteschlange, Playlist-Erstellung und Wiederfinden, englische/deutsche Navigation, Theme-Auswahl, Editor-Fokus und Einstellungssuche geprüft. Die Suchanfrage „Beethoven Moonlight Sonata“ lieferte Titel und Alben. Benannte Testdaten `Dusk-Testsignal` und `Dusk UI Test` befinden sich nur im lokalen Vorschauprofil.

**Offene funktionale Grenze:** YouTube verweigerte den getesteten Audioabruf mit „Sign in to confirm you’re not a bot“. Lokale Wiedergabe funktioniert; zuverlässiges Katalog-Streaming und YouTube-Offline-Downloads sind damit ausdrücklich nicht abgenommen. iPhone-Hintergrundwiedergabe, Lock-Screen-Steuerung, native Downloads, VoiceOver, Notch und Sideloading brauchen einen Gerätetest.

## iPhone-Build

Das native Projekt wurde mit Capacitor synchronisiert. Unter Linux wird kein Xcode-Build ausgeführt. Der GitHub-Mac-Build von Commit `8dfd6f70873bbbab9312cae2d03c79dd2262daa2` war erfolgreich:

- Repository (öffentlich, Stand 13. November 2026): https://github.com/zxypablo11/dusk-ios
- Build und Actions-Artefakt: https://github.com/zxypablo11/dusk-ios/actions/runs/42917861317
- Lokaler Download: `dist-ipa/Dusk.ipa` (2.931.190 Bytes, unsigniert)
- SHA-256: `5b093bd72394892da49795c12d15d556cddb4d76d823c090313916ad9ab6eb05`
- Im Archiv geprüft: App-Name Dusk, Bundle-ID, DE/EN, iOS-Mindestversion 16.2, Assets.car, Weboberfläche und separate Erweiterungs-ID `io.github.zxypablo11.dusk.LyricsWidget`.

Die Bilder `design/dusk/app-integrated.jpg`, `app-home-integrated.jpg` und `app-settings-integrated.jpg` zeigen die funktionale Browseroberfläche bei 390 × 844. Die späteren Dokumentations- und Bildcommits verändern den gebauten App-Code nicht.

 Für den vom Nutzer gewählten GitHub-Mac-Runner steht `.github/workflows/dusk-ios.yml` bereit: nur `workflow_dispatch`, nur `contents: read`, kein Release/Pages-Publishing. Der Job installiert die festgeschriebenen Abhängigkeiten, erstellt den Webbuild, synchronisiert Capacitor, kompiliert unsigniert und lädt `Dusk.ipa` als 14 Tage verfügbares Actions-Artefakt hoch.

Lokal auf macOS mit Xcode und Node 22+:

```sh
npm ci
DUSK_BUNDLE_ID=io.github.zxypablo11.dusk bash tools/build-dusk-ios.sh
```

Ergebnis: `dist/Dusk.ipa`. Vor Installation mit einem Sideloading-Werkzeug signieren. Der Build allein belegt keine fehlerfreie Wiedergabe auf dem Gerät.


## Figma

Neue Seite „Dusk · Personalisierung“:
https://www.figma.com/design/0yMqrWseFEJHvPok1JpEtA/Dusk-iPhone?node-id=2-3

`design/dusk/dusk-personalization.svg` enthält vier editierbare SVG-Screens. `figma-personalization.jpg` dokumentiert den geprüften Import; `app-themes.jpg` zeigt die funktionale App. Die Figma-Screens sind ein statischer Gestaltungsentwurf ohne Auto Layout oder verknüpfte Prototyp-Aktionen. Die mobile Hauptnavigation, Startseite, Sammlung, Player und Einstellungsübersicht sind als funktionale Adaption umgesetzt. Detailseiten und seltene Dialoge verwenden weiter die überarbeitete Muriel-Basis.
