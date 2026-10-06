<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Player entitlements are refreshed through the `mypimusic:membership-changed` browser event after activation, because package controls must update without reloading while the server remains authoritative.
- Video ads use media events for lifecycle state and a progress-reset stall watchdog, because elapsed wall-clock time must never count buffering as successful completion.
