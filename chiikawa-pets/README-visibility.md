# Character visibility controls

The six native checkboxes and **모두 꺼내기 / 모두 넣기** control visibility only.
**자동 동작 일시정지 / 재개** is independent: pausing leaves characters visible;
hiding does not alter the saved pause preference or approve any new movement.

Preference key: `jlpt-pet-visibility-v1`, containing schemaVersion1, six boolean
`visible` values and `paused`. Invalid/unknown fields are normalized safely.
The study data key is never accessed or migrated by this code. The previous
mobile-group preference is retained; when the new mobile dock exists it provides
access to all selected characters rather than silently turning preferences off.

There is exactly one engine actor per character. `setVisibleCharacters(ids)`
clears pending reactions, captures, airborne state and paired reservations before
hiding; it does not force a throw, landing or recovery performance. Repeated hide
is safe. If every actor is hidden the shared RAF stops; showing one restarts it.
A focused actor being hidden hands focus to its own visibility checkbox.

On narrow viewports the actors occupy a horizontal document-flow dock with one
slot per selected character. Native horizontal/vertical scrolling has priority
over capture. The actor layer follows slot coordinates and is clipped to the
dock viewport; offscreen slots are not clamped into a pile at x=0. Per-slot native
focus buttons scroll the requested slot into view and focus its existing actor.
Slots have end padding so the last complete silhouette can be reached.

Automated checks cover preference normalization, pause independence, capture
cleanup, pair cleanup, all-hidden RAF stop/restart, focus handoff and six-actor
dock geometry. Desktop browser checks cover individual/all toggles, reload
persistence, Space checkbox activation, hide/re-show and unchanged study data.
Actual mobile touch/screen-reader testing remains a separate QA step; simulated
DOM geometry is not a claim of real-device verification.
