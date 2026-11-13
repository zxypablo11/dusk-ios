# Dusk app UI polish

Approved by the user's “okay lets goo” after the UI review. Implement the suggested playback feedback, useful empty search, personal continuation and language/contrast polish in the existing app.

## Idea: Deine Musik bleibt im Blick

Use the existing cover-led layout, open rows and type hierarchy. Ban new card surfaces, filter pills and decorative effects. Keep the existing dark palette and type family; use 20 px page padding, 22 px section headings, 14–15 px rows, secondary ink mixed at 70%, 44 px minimum actions, and a 14 px playback marker. Loading may animate a small functional spinner; reduced motion keeps it still.

## Approaches

The review considered adding a compact continuation area, making empty search useful and improving playback feedback. The user approved the proposals. Implement them together using existing data and controls rather than adding another navigation surface.

## Behavior

- The selected song is marked immediately in home tiles and existing song lists. Loading, playing and paused states remain distinct, with an accessible status announcement.
- Empty search shows up to eight recent completed searches and six successfully visited artists, saved locally per profile. Selecting a query reruns it; queries can be removed or cleared. Corrupt or unavailable storage cannot block search.
- “Weiterhören” appears above recommendations when listening history exists, with the latest song and most recently saved playlist. Existing theme visibility settings still apply.
- Add reviewed German translations for new labels and “Listen next”; strengthen secondary text contrast within the mobile shell.
- Keep playback, source resolution and offline downloads in the existing core. No website edits or new dependencies.

## Verification

Test bounded/deduplicated profile history and playback-state precedence. Verify the rendered mobile app at 390 × 844, 375 × 812 and landscape, including long titles, keyboard controls, rapid selections, reload persistence and cleared history. Run the full Node suite and build a new iPhone IPA; physical-device behavior remains unverified.
