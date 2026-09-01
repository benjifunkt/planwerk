# Project Context: Planwerk

## North Star

Planwerk hilft Menschen, mit etwa fünf Minuten Planung am Tag genug Orientierung zu bekommen, um an den richtigen Dingen zu arbeiten und ihre Ziele wahrscheinlicher zu erreichen.

Es soll Richtung geben, nicht Kontrolle ausüben. Planwerk ist kein KPI-Productivity-Optimization-Tool, kein Enterprise-Projektmanagement und kein System, das den Alltag möglichst vollplant. Die App soll helfen, das Wesentliche sichtbar zu machen: Was ist wichtig, was passt in diese Woche, und was ist der nächste sinnvolle Schritt?

## Positionierung

Planwerk ist eine ruhige Selbstmanagement-App für einzelne Nutzerinnen und Nutzer. Sie richtet sich an Menschen, die sich selbst organisieren müssen oder wollen: Selbstständige, Kreative, Gründerinnen, Wissensarbeiter, Studierende oder alle, die viele offene Dinge im Kopf haben und eine klare, leichte Struktur brauchen.

Die App soll sich menschlich anfühlen. Sie gibt Orientierung, macht Vorschläge und reduziert Unklarheit, ohne Druck, Schuldgefühl oder Performance-Sprache aufzubauen. Erfolg bedeutet nicht, möglichst viel zu erledigen, sondern bewusster zu entscheiden, worauf Zeit und Aufmerksamkeit gehen.

## Produktprinzipien

- **Simplicity:** Jede Funktion braucht einen klaren Zweck. Wenn eine einfachere Lösung reicht, ist sie meistens besser.
- **Fokus auf das Wesentliche:** Zeige die wichtigste Information zuerst. Details dürfen vorhanden sein, sollen aber nicht dominieren.
- **Calm Guidance:** Hinweise sollen freundlich, kurz und handlungsorientiert sein. Keine Panik, kein Druck, keine Schuld.
- **Clarity over Flexibility:** Lieber wenige klare Wege als viele konfigurierbare Optionen. Maximal etwa fünf Optionen, oft weniger.
- **Low Cognitive Load:** Jede Ansicht soll schnell erfassbar sein. Nicht zu viel gleichzeitig fragen, anzeigen oder verlangen.
- **Human Language:** Texte klingen direkt, warm und alltagsnah. Kein Corporate-Sprech, kein technischer Jargon, keine Produktivitätsparolen.
- **Power through Structure:** Planwerk darf kraftvoll sein, aber durch klare Abläufe und gute Defaults, nicht durch komplexe Feature-Fülle.

## UX und Design

Planwerk soll ruhig, fokussiert und reduziert wirken, mit einer leichten Nähe zu Schweizer Grafikdesign: klare Hierarchie, starke Typografie, viel Ordnung, wenig visuelles Rauschen.

Die visuelle Basis ist schwarz-weiß mit gezielten Akzenten. Die App soll nicht langweilig wirken, aber auch nie unruhig. Komponenten dürfen leicht taktil sein, bleiben aber schlank. Vermeide Enterprise-Ästhetik, überladene Kartenlandschaften, schwere Dashboards und dekorative Effekte ohne Funktion.

Animationen sind subtil und haben immer einen Sinn: Sie lenken den Blick, bestätigen eine Handlung oder machen einen Zustand verständlich. Keine Gamification, keine lauten Belohnungssysteme, keine aggressiven Notifications. Wenn etwas gefeiert wird, dann kurz, charmant und nicht als Produktivitätsdruck.

## Produktstruktur

- **Board und Woche:** Das Board ist der zentrale Ort für die aktuelle Planung. Es hilft, Backlog und konkrete Tage für die laufende Woche zu ordnen.
- **Backlog:** Aufgaben können gesammelt werden, ohne sofort alles perfekt einzuplanen.
- **Aufgaben:** Aufgaben sollen schnell erfassbar sein. Gute Aufgaben sind eher klein, konkret und startbar.
- **Ziele:** Drei-Monats-Ziele geben eine grobe Richtung. Sie sind Orientierung, kein starres Planungsversprechen.
- **Wochenziel:** Das Wochenziel übersetzt größere Richtung in einen nächsten Fokus.
- **Reflexion:** Reflexion hilft zu erkennen, welche Arbeit wirklich getragen hat. Sie bewertet nicht die Person.
- **Analytics:** Auswertungen sind unterstützender Kontext, keine KPI-Zentrale. Sie sollen Muster zeigen, nicht Druck erzeugen.
- **Einstellungen und Datei:** Einstellungen, Vorlagen und Datei-Handling unterstützen den Workflow, sollen aber nicht zum Mittelpunkt werden.

Planwerk plant nicht die nächsten Monate im Detail. Der Fokus liegt auf der aktuellen Woche, eventuell der nächsten Woche und einer groben Zielrichtung für die kommenden Monate.

## Technische Prinzipien

Planwerk ist local-first und läuft auf dem Gerät der Nutzerin oder des Nutzers. Die eigenen Daten bleiben unter Nutzerkontrolle. Das `.planwerk`-Dateiformat ist ein zentrales Produktversprechen und soll verlässlich, nachvollziehbar und robust bleiben.

Technische Entscheidungen sollen diese Richtung schützen:

- keine Remote-Abhängigkeit für Kernfunktionen
- keine eingebauten API-Secrets oder runtime CDNs für die Produktions-App
- klare, modulare Datenflüsse rund um `.planwerk`-Dateien
- lesbarer Code mit kleinen, gut verständlichen Modulen
- schnelle Startup-Zeiten und reaktionsschnelle Interaktionen
- vorsichtige Migrationen und Rückwärtskompatibilität für vorhandene Dateien

## Decision Framework

Wenn eine Entscheidung unklar ist, frage:

1. Macht es die tägliche Fünf-Minuten-Planung leichter?
2. Reduziert es kognitive Last oder fügt es neue Last hinzu?
3. Gibt es Orientierung ohne Druck?
4. Ist die wichtigste Information sofort sichtbar?
5. Bleibt die App local-first, schnell und nachvollziehbar?
6. Würde ein Mensch das so sagen, oder klingt es nach Corporate-Software?

Wenn eine Idee vor allem mehr Metriken, mehr Optionen, mehr Automatisierung oder mehr langfristige Detailplanung bringt, ist sie wahrscheinlich nicht passend für Planwerk.

## Nicht-Ziele

- Kein Enterprise-Projektmanagement.
- Kein KPI- oder Performance-Dashboard.
- Keine Gamification-Schleifen.
- Keine aggressiven Notifications.
- Keine Produktivitäts-Schuldgefühle.
- Keine überladenen Seiten, auf denen alles gleichzeitig möglich ist.
- Kein technischer Jargon in Nutzertexten.
- Keine Features, die nur existieren, weil andere Produktivitätstools sie haben.

## Produktnotizen

Dieses Dokument beschreibt die dauerhaften Prinzipien, an denen neue Entscheidungen ausgerichtet werden sollen. Unfertige Arbeitsnotizen und private Produktideen gehören nicht in den öffentlichen Repository-Snapshot.
