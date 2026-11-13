# Family TV

A "Who's watching?" home app for a Fire TV Stick 4K Max (Fire OS 7), with a playful **Kids** home and a cinematic **Parents** home behind a PIN.

- **Kids:** Deal or No Deal on 10 Play, YouTube (each child picks their own account), Netflix, ABC Kids on iview, Disney+, Prime Video, 10 Play, games, and family movies and kids' series streaming on Netflix and Prime in Australia.
- **Parents:** a hero banner, popular this week (ranked), new movies, new series, top rated, Live TV (7plus, 9Now, 10 Play, SBS, ABC iview, Smart IPTV) and all your apps, with Movies, Series, Live TV and Apps tabs.
- **Remote first:** arrows move, OK selects, Back goes back. It opens when the TV starts, and returns to "Who's watching?" after the screen turns off or 20 minutes away.

## How it's built
- Android app: a full-screen WebView (`app/src/main/assets/www`) with a small Java bridge (`Bridge.java`) that lists and opens apps, stores the parents PIN (salted hash) and calls TMDB.
- Every push to `main` builds a signed APK with GitHub Actions and publishes it as a release.
- Install or update from the PC with the Fire TV toolkit: `firetv.ps1 homeapp`.

## Settings
- What each screen shows: `app/src/main/assets/www/config.js`.
- TMDB key: never committed. On the PC run `firetv.ps1 homeapp-key`; it's sent to the TV over adb.
- Forgot the PIN: `firetv.ps1 homeapp-resetpin`.

## Signing key
Releases are signed with a key kept in the repository secrets `KEYSTORE_B64`, `STORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`, so each update installs over the previous one.

## Limits
- Fire OS 7 doesn't let other apps replace Amazon's Home screen, so the Home button still goes to Amazon's home. For real child locks, also use Fire TV parental controls and Netflix/YouTube profile settings.
- Rows use TMDB popularity and JustWatch availability (via TMDB), not Netflix's or Prime's own charts. Choosing a title opens the service's app.

This product uses the TMDB API but is not endorsed or certified by TMDB.
