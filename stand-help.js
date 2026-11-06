window.STAND_COPY = {
  "name": "Seclusa Pyramid",
  "source": "https://github.com/ambr3/seclusa-pyramid",
  "corner": "right",
  "sound": true,
  "sounds": [
    { "label": "Sounds", "key": "ssc.pref_key_sound_enabled" },
    { "label": "Winning sound", "key": "ssc.pref_key_sound_win_enabled", "follow": "ssc.pref_key_sound_enabled" }
  ],
  "rules": [
    "Twenty-eight cards are dealt face up in seven rows. Pair cards whose values add to 13.",
    "Kings come off on their own. Queens pair with aces, jacks with twos, tens with threes, and so on.",
    "Only a card with nothing resting on it can be played. Both cards of a pair go to the king pile.",
    "The stock deals one card at a time onto the waste. Turning an empty stock over costs score.",
    "You win when the pyramid is clear. On the hard setting the stock and waste must be empty too."
  ],
  "about": [
    "Forked directly from https://github.com/TobiasBielefeld/Simple-Solitaire",
    "Simple Solitaire Collection - https://github.com/TobiasBielefeld/Simple-Solitaire - Copyright 2016 - Tobias Bielefeld - tobias.bielefeld@gmail.com - Licensed under GPLv3+ https://www.gnu.org/licenses/gpl-3.0",
    "Modified to play Pyramid in the browser. No ads, no accounts, and nothing is sent off the device."
  ]
};
