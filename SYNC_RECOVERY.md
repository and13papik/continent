# Synchronization recovery

After a successful cloud read, compatible edits are merged as before. Disputed
records are kept out of automatic writes. The browser first commits the complete
local state, cloud state, baseline, and review items to an IndexedDB transaction.
Only then does it display the cloud version of the disputed records and continue
synchronizing independent changes. A failed archive leaves local data untouched.

The amber review notice survives reload. Users can retain the currently displayed
record or explicitly apply the saved local record. The latter checks the displayed
value again and uses the normal conditional cloud save; it cannot force an
unconditional overwrite. Financial records are reviewed as a unit so related
gross/net/total fields are not mixed. Archives are retained after review and are
never automatically pruned. They are local to this browser, not a server backup.

When no trustworthy baseline exists, local-only records are retained for review,
not automatically resurrected. A browser storage failure still requires user
attention; recovery cannot promise to resolve two conflicting financial values
without a human choice.

Visible tabs check a small timestamp + revision projection every five seconds.
Unchanged polls do not transfer or re-render the complete financial state. Focus
and network reconnection trigger a refresh. The revision is included to detect
separate saves with identical timestamps. Pages are lazy-loaded; a redundant
blocking html2canvas CDN script was removed (the installed module remains).

Validation: 93 unit/integration tests, TypeScript check, production Vite build;
Chrome with real IndexedDB and an isolated API copy verifies archive durability,
reload, explicit conflict choice, conditional save, same-timestamp revision
updates, and loading the main admin routes. No production financial test writes.
