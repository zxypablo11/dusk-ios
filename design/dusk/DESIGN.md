# Dusk — Designrichtung

Dusk is a free music player for everyone (desktop, phone, browser). These comps started on a phone canvas; the same tokens and calm chrome apply across platforms.

## Revision 2: Personalisierung (10. November 2026)

Bestätigt: Deutsch und Englisch, automatische Gerätesprache, kleines zurückhaltendes Logo. Frühe Entwürfe zielten auf iPhone 14; die Richtung gilt für die gesamte App. Das D-Monogramm und der große Sora-Schriftzug wurden durch ein Horizontzeichen und einen kleinen, schlichten Dusk-Schriftzug ersetzt. Inter approximiert im Entwurf die native Systemschrift. Die Seite **Dusk · Personalisierung** ergänzt Einstellungen, sechs Themes und einen Theme-Editor.

Figma: https://www.figma.com/design/0yMqrWseFEJHvPok1JpEtA/Dusk-iPhone?node-id=2-3

Der SVG-Import wurde mit sichtbaren Texten und Coverbildern geprüft. `figma-personalization.jpg` zeigt den Figma-Stand. Die bisherige Seite wurde beibehalten. `dusk-personalization.svg/.png` und die Einzelscreens entstehen mit `python3 design/dusk/render-personalization.py`. Der Entwurf ist statisch, editierbar, ohne Auto Layout oder Prototyp-Verbindungen.

Funktionale Umsetzung und Prüfungen stehen in `../../DUSK.md`. Die mobile Hauptnavigation, Startseite, Sammlung, Player und Einstellungsübersicht sind in der App integriert. Detailseiten nutzen weiterhin die bestehende Dusk-Basis. Systemeinstellungen, Sprachwahl und Themes funktionieren im lokalen Webbuild. Native iPhone-Prüfung steht aus.

Die folgenden Abschnitte dokumentieren die ursprüngliche Designrichtung und sind teilweise durch Revision 2 ersetzt.

## Bestätigt

Name: Dusk. Free player for everyone — Windows, phone, browser. Sideloading on iOS is fine where App Store isn’t the path. Visual reference: dark, soft, quiet surfaces. No glow effects.

## Annahmen für diesen Entwurf

Die Startseite verbindet Weiterhören und Entdecken. Die bisherige Funktionsbasis wird zunächst nicht geändert. Musik und Metadaten auf den Screens sind eine Beispielauswahl zur Gestaltung, keine Behauptung über verfügbare Streams. Zunächst werden Startseite und Player zur visuellen Abstimmung entworfen. Eine iOS-Version und der Zugang zu macOS/Xcode sind noch zu klären.

## Gestaltung vor Umsetzung

Palette: Hintergrund `#131416`, Fläche `#202125`, angehobene Fläche `#2B2D32`, Primärtext `#F5F5F7`, Sekundärtext `#A9ABB3`, aktiver Zustand `#C0C5E8`.

Schrift: Sora für die Oberfläche und den kleingeschriebenen Dusk-Schriftzug. Die etwas kantigeren Rundungen geben Dusk einen technischen Charakter. Weiß trägt primäre Aktionen; die kühle Akzentfarbe markiert wenige aktive Zustände.

Struktur: linksbündige Inhalte, 20–24 Punkte Außenabstand, 390 × 844 Punkte Entwurfsgröße. iPhone-14-Statusbereich mit Notch statt Dynamic Island. Die Navigation hat drei Ziele: Entdecken, Sammlung, Suche. Der Miniplayer bleibt darüber erreichbar. Der Vollbildplayer hat einen eigenständigen Abschluss mit zwei gut erreichbaren Zugängen zu Lyrics und Warteschlange.

```
Startseite                  Player
Status                      Status
Dusk / Einstellungen        Zurück / Mix / Optionen
Für dich / Neu / Mixes       Großes Cover
Großer Mix mit Cover         Titel / Künstler / Favorit
Zuletzt gehört              Offline speichern
Miniplayer                  Zeitachse / Transport
3 Navigationsziele          Lyrics / Warteschlange
```

## Abgleich mit der Referenz

Übernommen werden die ruhigen dunklen Flächen, großen Cover und weichen Formen. Eigenständig sind Schriftzug, Monogramm, Dreiernavigation, Mixdarstellung, kompakte Weiterhören-Liste und Player-Anordnung. Die Bildauswahl trägt die Atmosphäre; Oberfläche und Hintergrund erhalten keine dekorativen Verläufe, Lichtflecken, Wellenvisualisierungen oder Partikel.

Die allgemeine UI/UX-Suche lieferte für Musik teilweise unpassende Landingpage-, Glow- und Farbvorschläge. Diese wurden nicht übernommen. Eine zweite, gezielte Suche lieferte allgemeine Minimalismus-Regeln, aus denen nur Klarheit, Kontrast und zurückhaltende Bewegung übernommen wurden. Die konkrete Richtung folgt dem Nutzerbriefing und dem Frontend-Design-Skill.

## Umsetzung nach Designabstimmung

Die mobile Ansicht von Dusk erhält eine abgegrenzte Dusk-Themeschicht und gezielte Änderungen an der mobilen Navigation. Playerzustand, Datenhaltung und Quelladapter bleiben zunächst die bestehende technische Grundlage. Originale Lizenzhinweise werden beibehalten. Keine neue Framework-Abhängigkeit für das Rebranding.

Vor der Implementierung werden aus dem bestätigten Entwurf gemeinsame Farb-, Schrift-, Abstands- und Radius-Tokens abgeleitet. Touch-Flächen mindestens 44 × 44 Punkte; Schriftgrößen müssen später mit Dynamic Type, VoiceOver und den echten Safe Areas geprüft werden. Ein statischer Figma-Entwurf belegt keine funktionierende Wiedergabe oder Downloads.

## Dateien und Herkunft

Figma: https://www.figma.com/design/0yMqrWseFEJHvPok1JpEtA/Dusk-iPhone?node-id=1-177

Das Board liegt auf der Seite „Dusk · Designrichtung“. Der Import wurde am 10. November 2026 visuell geprüft; beim ersten Import fehlende Sora-Darstellung wurde durch Laden der Schriftschnitte und erneuten Import korrigiert. Die fehlerhafte Importfassung wurde entfernt. Text und Vektoren sind editierbar. `figma-dusk.jpg` zeigt den geprüften Stand im Editor. Dies ist ein statischer Entwurf ohne Auto-Layout-Komponenten oder Prototyp-Verbindungen.

Textkontraste: Primärtext auf Hintergrund 16,93:1; Sekundärtext auf normaler Fläche 7,02:1 und auf angehobener Fläche 6,01:1. SVG-Dateien sind wohlgeformt und haben eindeutige IDs. Interaktion, große Systemschrift und native Wiedergabe sind in diesem Designschritt noch nicht getestet.

`dusk-home.svg`, `dusk-player.svg` und `dusk-board.svg` enthalten editierbare Vektor- und Textebenen sowie eingebettete Albumcover. `assets/sources.json` dokumentiert die über die öffentliche iTunes-Suche gefundenen Cover. Die Cover dienen als Beispielinhalte und sind keine Dusk-eigenen Illustrationen. Es wurden keine Audiodateien heruntergeladen.
