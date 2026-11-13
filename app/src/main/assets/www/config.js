/*
 * Family TV settings: edit this file to change what each screen shows, then push to GitHub.
 * Apps are found by package name first, then by their name on the TV ("match").
 */
window.FTV_CONFIG = {
  apps: {
    youtube:   { name: 'YouTube',       pkgs: ['com.amazon.firetv.youtube'], match: /^youtube$/i },
    netflix:   { name: 'Netflix',       pkgs: ['com.netflix.ninja'] },
    prime:     { name: 'Prime Video',   pkgs: ['com.amazon.firebat', 'com.amazon.avod'], match: /prime video/i },
    disney:    { name: 'Disney+',       pkgs: ['com.disney.disneyplus'] },
    iview:     { name: 'ABC iview',     pkgs: ['au.net.abc.iview'] },
    tenplay:   { name: '10 Play',       pkgs: ['au.com.tenplay'] },
    sevenplus: { name: '7plus',         pkgs: ['com.swm.live'] },
    ninenow:   { name: '9Now',          pkgs: ['au.com.ninenow.ctv'] },
    sbs:       { name: 'SBS On Demand', pkgs: ['com.sbs.ondemand.tv'] },
    siptv:     { name: 'Smart IPTV',    pkgs: ['eu.siptv.video'] },
    hbo:       { name: 'HBO Max',       pkgs: ['com.hbo.hbonow'] },
    twitch:    { name: 'Twitch',        pkgs: ['tv.twitch.android.viewer'] },
    tvbro:     { name: 'TV Bro',        pkgs: ['com.phlox.tvwebbrowser'] },
    redball:   { name: 'Red Ball 4',    pkgs: ['com.FDGEntertainment.RedBall4.amazon'] },
    mathfun:   { name: 'Math Fun',      pkgs: ['com.mathsgame.mathfun'] }
  },

  // Kids home
  // url: tried first so 10 Play opens the show itself; tmdbTv: the show's TMDB id for its background artwork.
  kidsFeatured: { title: 'Deal or No Deal', badge: 'Family favourite', cta: 'Watch on 10 Play', app: 'tenplay',
                  url: 'https://10play.com.au/deal-or-no-deal', tmdbTv: 2176 },
  kidsSide: [
    { app: 'youtube', title: 'YouTube', note: 'Pick your own account', icon: 'play', bg: '#FF6B5B' },
    { app: 'netflix', title: 'Netflix', note: 'Choose your Kids profile', icon: 'star', bg: '#1F2240' }
  ],
  kidsApps: [
    { app: 'iview',   name: 'ABC Kids',    note: 'on ABC iview',    bg: '#8B5CF6', fg: '#FFFFFF' },
    { app: 'disney',  name: 'Disney+',     note: 'Kids profile',    bg: '#2F5FE0', fg: '#FFFFFF' },
    { app: 'prime',   name: 'Prime Video', note: 'Kids shows',      bg: '#19B5A5', fg: '#1F2240' },
    { app: 'tenplay', name: '10 Play',     note: 'Family shows',    bg: '#FFC93C', fg: '#1F2240' },
    { app: 'netflix', name: 'Netflix',     note: 'Cartoons',        bg: '#1F2240', fg: '#FFFFFF' },
    { app: 'youtube', name: 'YouTube',     note: 'Your own account', bg: '#FF6B5B', fg: '#1F2240' }
  ],
  kidsGames: [
    { app: 'redball', name: 'Red Ball 4', bg: '#E5484D', fg: '#FFFFFF' },
    { app: 'mathfun', name: 'Math Fun',   bg: '#19B5A5', fg: '#1F2240' }
  ],

  // Parents home
  liveTv: ['sevenplus', 'ninenow', 'tenplay', 'sbs', 'iview', 'siptv'],
  parentsApps: ['netflix', 'prime', 'youtube', 'disney', 'hbo', 'twitch', 'tvbro'],

  // Streaming services on TMDB (Australia). Netflix = 8, Amazon Prime Video = 9 / 119.
  providers: { netflix: '8', prime: '9%7C119' },
  region: 'AU',
  cacheHours: 6
};
