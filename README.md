# WordEntropy
How many words can you find before entropy hits

In a random characters grid, find as many words as you can.

To change any character, find other characters where the range in the alphabet between them contains the character you want.

They will then become the same character.

For example:
```
lgaxep
```
You can swap l,p and x for m and form the word game.

```
mgamem
```



## Play

Open `index.html` in a modern browser. No build, server, or internet connection is needed.

Select two tiles anywhere in the 7×7 board, then choose a letter strictly between their letters in the alphabet and press **Replace** (or type that letter). Both tiles become that letter.

The game automatically checks words horizontally left to right and vertically top to bottom, for words of 4–7 letters after every move. Starting boards contain no valid words: matching letters are rerolled until every row and column is clear. Words can occur inside longer sequences. Each unique word counts once and scores one point per letter. There is no timer: press **End game** when you cannot think of another move to see your final score. **Play again** resets everything with a fresh board. Share score uses browser sharing, copies to the clipboard where available, or displays text to copy.

## Dictionary

`words_en.js` bundles 94,979 unique alphabetic words of 4–7 letters from [dwyl/english-words, words_alpha.txt](https://github.com/dwyl/english-words/blob/master/words_alpha.txt), downloaded on 2026-10-11. The full source list has over 370,000 entries; longer and shorter words cannot fit the game's rules and are omitted. Entries are uppercased and deduplicated. This broad dictionary includes uncommon and archaic words.

The upstream repository's license is preserved in `WORDS-LICENSE.txt`. Its README also attributes the original dataset to Infochimps and notes that copyright belongs to the original source: https://github.com/dwyl/english-words.

Run the game logic checks with `node test/game.test.cjs`.

Board generation uses ten dictionary Set lookups per line and caches matches for all seven rows and seven columns. It rerolls only tiles in matches (deduplicating overlaps), then rechecks their rows and columns, including words created in the perpendicular direction. A 64-round cap and verified word-free fallback board keep work bounded. After a move, only affected rows and columns (at most four lines) are checked. The responsive interface uses local font stacks, CSS animations with reduced-motion support, and native dialogs for rules and the final score.
