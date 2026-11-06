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
    "Pair them off and clear the deck. Forked from Tobias Bielefeld's Simple Solitaire Collection (GPL-3.0), by way of Seclusa Solitaire.",
    "No ads, no tracking. Games and settings stay on this device."
  ]
};
