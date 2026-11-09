# Mój Plan – Media Design

PWA z planem z pliku CSV IDEIS. Uwzględnia wyłącznie Cw2S i WykS. Grupa LabAS jest pominięta do potwierdzenia.

## Uruchomienie

W folderze projektu uruchom `python3 -m http.server 8080`, potem otwórz http://localhost:8080. Nie otwieraj index.html bezpośrednio jako pliku.

## Publikacja

Wrzuć zawartość folderu na Cloudflare Pages (Direct Upload) lub inny hosting HTTPS. Na iPhone otwórz stronę w Safari, użyj Udostępnij → Dodaj do ekranu początkowego.

## Aktualizacja

Eksportuj świeży plik CSV z IDEIS, otwórz sekcję „Aktualizacja harmonogramu” i wybierz plik. Aplikacja pokaże różnice i zapisze plan lokalnie. To nie jest automatyczna synchronizacja ani oficjalny kanał odwołań. CSV jest parsowany jako CP1250; proste rozdzielanie po średnikach zakłada brak średników w polach danych.

## Kolejny etap

Sprawdzić legalność i techniczną dostępność eksportu HTTP, zbudować backend do okresowego pobierania i Web Push, wdrożyć autoryzację i bezpieczne wykrywanie przeniesionych zajęć.
