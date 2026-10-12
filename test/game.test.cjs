const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const dictionarySource = fs.readFileSync(path.join(root, 'words_en.js'), 'utf8');
const dictionary = vm.runInNewContext(`${dictionarySource}\n[...words]`);

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.classes = new Set(); this.listeners = {};
        this.classList = { add: n => this.classes.add(n), remove: n => this.classes.delete(n), toggle: (n, state) => state ? this.classes.add(n) : this.classes.delete(n) };
    }
    appendChild(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    get options() { return this.children; }
}
function setup(wordList = ['CAST', 'CASTS', 'COLD', 'CATS', 'CATSUP', 'DOGS', 'ABCDEFG', 'WXYZ', 'CAT']) {
    const ids = ['game', 'charSelector', 'replace', 'score', 'wordCount', 'moveCount', 'status', 'wordsFound', 'end', 'restart', 'helpDialog', 'scoreDialog', 'finalScore', 'finalWords', 'finalMoves', 'shareStatus', 'selectionCount'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    const events = {};
    const context = vm.createContext({ dictionary: wordList, console, navigator: {}, window: { isSecureContext: false }, document: {
        getElementById: id => elements[id], createElement: tag => new Element(tag), addEventListener: (name, callback) => { events[name] = callback; }
    }});
    const run = code => vm.runInContext(code, context);
    run('const words = new Set(dictionary);');
    run(gameSource);
    function board(entries) {
        const board = Array(25).fill('Q');
        for (const [index, letter] of Object.entries(entries)) {
            assert.ok(Number(index) >= 0 && Number(index) < 25, 'fixture tile must be on the board');
            board[Number(index)] = letter;
        }
        run(`allChars = ${JSON.stringify(board)}; wordsFound.clear(); score = moves = 0;`);
    }
    return { run, elements, board, events };
}

test('bundled dictionary includes CAST and only 4–5-letter words', () => {
    assert.ok(dictionary.includes('CAST'));
    assert.ok(dictionary.every(word => /^[A-Z]{4,5}$/.test(word)));
});

test('vertical CAST scores four points, including with the real dictionary', () => {
    const { run, board, elements } = setup(dictionary);
    board({ 4:'C', 9:'A', 14:'S', 19:'T' });
    run('checkForWords()');
    assert.equal(run("wordsFound.has('CAST')"), true);
    assert.equal(run('score'), 4);
    assert.equal(elements.wordsFound.children[0].textContent, 'CAST +4');
});

test('forming vertical CAST through a replacement immediately awards points', () => {
    const { run, board, elements } = setup();
    board({ 4:'A', 9:'A', 14:'S', 19:'T', 24:'E' });
    run("selectTile(4); selectTile(24); selectTile(20); selectTile(21); selectTile(22); replaceAllWithChar('C');");
    assert.equal(run("wordsFound.has('CAST')"), true);
    assert.equal(run('score'), 4);
    assert.equal(run('moves'), 1);
    assert.equal(elements.score.textContent, 4);
});

test('horizontal CAST scores four points and three-letter CAT does not count', () => {
    const { run, board } = setup();
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 5:'C', 6:'A', 7:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 4);
    assert.equal(run("wordsFound.has('CAT')"), false);
});

test('crossing horizontal and vertical words are both found in one move', () => {
    const { run, board } = setup();
    board({ 0:'A', 1:'A', 2:'S', 3:'T', 5:'O', 10:'L', 15:'D', 24:'E' });
    run("selectTile(0); selectTile(24); selectTile(20); selectTile(21); selectTile(22); replaceAllWithChar('C');");
    assert.equal(run("wordsFound.has('CAST') && wordsFound.has('COLD')"), true);
    assert.equal(run('score'), 8);
    assert.equal(run('wordsFound.size'), 2);
});

test('a word occurring in both directions and on later moves scores only once', () => {
    const { run, board, elements } = setup();
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 5:'A', 10:'S', 15:'T' });
    run('checkForWords(); checkForWords();');
    assert.equal(run('score'), 4);
    assert.equal(run('wordsFound.size'), 1);
    assert.equal(elements.wordsFound.children.length, 1);
});

test('overlapping four- and five-letter words count in either direction', () => {
    const { run, board } = setup(['CAST', 'CASTS']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 4:'S', 5:'A', 10:'S', 15:'T', 20:'S' });
    run('checkForWords()');
    assert.equal(run('score'), 9);
    assert.equal(run('wordsFound.size'), 2);
});

test('five-letter horizontal words and four-letter words at bottom/right edges count', () => {
    const { run, board } = setup(['CASTS', 'CAST']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 4:'S', 21:'C', 22:'A', 23:'S', 24:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 9);
    board({ 9:'C', 14:'A', 19:'S', 24:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 4);
});

test('backwards and diagonal words do not count', () => {
    const { run, board } = setup(['CAST']);
    board({ 0:'T', 1:'S', 2:'A', 3:'C', 4:'T', 9:'S', 14:'A', 19:'C' });
    run('checkForWords()'); assert.equal(run('score'), 0);
    board({ 0:'C', 6:'A', 12:'S', 18:'T' });
    run('checkForWords()'); assert.equal(run('score'), 0);
});

test('words cannot wrap across row boundaries', () => {
    const { run, board } = setup(['WXYZ']);
    board({ 3:'W', 4:'X', 5:'Y', 6:'Z' });
    run('checkForWords()'); assert.equal(run('score'), 0);
});

test('starting-board cleanup removes horizontal and vertical words and deduplicates overlapping tiles', () => {
    const { run, board } = setup(['CAST', 'CASTS']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 4:'S', 5:'A', 10:'S', 15:'T', 24:'Z' });
    run("let rerolls = 0; removeStartingWords(allChars, () => { rerolls++; return 'Q'; });");
    assert.equal(run('rerolls'), 8); // Five horizontal + four vertical - shared C.
    assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
    assert.equal(run('allChars[24]'), 'Z', 'unmatched letters remain untouched');
    assert.equal(run('score'), 0);
});

test('cleanup catches perpendicular words created by rerolling a horizontal word', () => {
    const { run, board } = setup(['CAST', 'COLD']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 6:'O', 11:'L', 16:'D' });
    run("let rerolls = 0; removeStartingWords(allChars, () => 'QCQQQQQQ'[rerolls++]);");
    assert.equal(run('rerolls'), 8);
    assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
});

test('cleanup has a bounded, verified fallback for a pathological RNG', () => {
    const { run } = setup(['AAAA']);
    run("allChars = Array(25).fill('A'); let rerolls = 0; removeStartingWords(allChars, () => { rerolls++; return 'A'; });");
    assert.equal(run('rerolls'), 25 * 64);
    assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
});

test('1,000 real-dictionary starting boards contain no horizontal or vertical words', () => {
    const { run } = setup(dictionary);
    const before = performance.now();
    for (let i = 0; i < 1000; i++) {
        run('startGame()');
        assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
        assert.equal(run('score'), 0);
        assert.equal(run('wordsFound.size'), 0);
    }
    console.log(`1,000 verified starting boards: ${(performance.now() - before).toFixed(0)} ms, including DOM fixture and assertions.`);
});

test('a replacement checks only affected rows and columns, deduplicating shared lines', () => {
    const { run, board } = setup();
    board({ 0:'A', 1:'E', 2:'B', 3:'C', 4:'D' });
    run("let scanned = []; const originalScan = findLineWords; findLineWords = (board, line) => { scanned.push(line); return originalScan(board, line); }; selectTile(0); selectTile(1); selectTile(2); selectTile(3); selectTile(4); replaceAllWithChar('C');");
    assert.equal(run("scanned.sort((a,b) => a-b).join(',')"), '0,5,6,7,8,9');
});

test('replacement rejects endpoints, multi-character keys, and incomplete selections', () => {
    const { run, board } = setup();
    board({ 0:'A', 1:'E', 2:'B', 3:'C', 4:'D' });
    run("selectTile(0); selectTile(1); selectTile(2); selectTile(3); selectTile(4); replaceAllWithChar('A'); replaceAllWithChar('E'); replaceAllWithChar('ENTER');");
    assert.equal(run('moves'), 0);
    run("replaceAllWithChar('C')");
    assert.equal(run("allChars.slice(0,2).join('')"), 'CC');
    assert.equal(run('moves'), 1);
    assert.equal(run('selectedTiles.size'), 0);
});

test('end-game modal shows points, blocks moves, and replay resets the game', () => {
    const { run, board, elements } = setup();
    board({ 0:'C', 5:'A', 10:'S', 15:'T' });
    run('checkForWords(); endGame();');
    assert.equal(elements.scoreDialog.open, true);
    assert.equal(elements.finalScore.textContent, 4);
    assert.equal(elements.finalWords.textContent, 1);
    assert.ok(elements.game.children.every(cell => cell.disabled));
    run("allChars[0]='A'; allChars[1]='E'; selectTile(0); selectTile(1); selectTile(2); selectTile(3); selectTile(4); replaceAllWithChar('C');");
    assert.equal(run('moves'), 0);
    run('startGame()');
    assert.equal(elements.scoreDialog.open, false);
    assert.equal(run('score'), 0);
    assert.equal(run('wordsFound.size'), 0);
    assert.equal(run('ended'), false);
    assert.ok(elements.game.children.every(cell => !cell.disabled));
});

test('rules dialog blocks keyboard replacements while open', () => {
    const { run, board, events } = setup();
    board({ 0:'A', 1:'E', 2:'B', 3:'C', 4:'D' });
    run('selectTile(0); selectTile(1); selectTile(2); selectTile(3); selectTile(4); showHelp();');
    events.keydown({ key:'c', target:{ tagName:'BODY' } });
    assert.equal(run('moves'), 0);
    run('hideHelp()');
    events.keydown({ key:'c', target:{ tagName:'BODY' } });
    assert.equal(run('moves'), 1);
});

test('requested copy is removed and visible rules specify both directions', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const removed = ['Make every', 'Two letters. One possibility.', 'Take your time.', 'LESS RANDOM.', 'A blank page', 'Your next word', 'Share your score ↗'];
    for (const phrase of removed) assert.ok(!html.includes(phrase), phrase);
    assert.ok(!gameSource.includes('A little change. What can you find next?'));
    assert.match(html, /4–5 letters · Horizontal → · Vertical ↓/);
    assert.match(html, /top to bottom/);
    assert.match(html, /Find words before entropy takes over\./);
});

test('board has exactly 25 tiles on startup and replay', () => {
    const { run, elements } = setup();
    assert.equal(elements.game.children.length, 25);
    assert.equal(run('allChars.length'), 25);
    run('endGame(); startGame();');
    assert.equal(elements.game.children.length, 25);
    assert.equal(run('allChars.length'), 25);
});

test('five tiles use the full exclusive min/max range and all become the chosen letter', () => {
    const { run, board, elements } = setup();
    board({ 0:'D', 6:'F', 12:'H', 18:'I', 24:'M' });
    run("[24, 12, 0, 18].forEach(selectTile); replaceAllWithChar('G');");
    assert.equal(run('moves'), 0);
    assert.equal(elements.replace.disabled, true);
    run('selectTile(6)');
    assert.equal(elements.charSelector.options.map(option => option.value).join(''), 'EFGHIJKL');
    assert.equal(elements.replace.disabled, false);
    run("replaceAllWithChar('D'); replaceAllWithChar('M');");
    assert.equal(run('moves'), 0);
    run("replaceAllWithChar('F');");
    assert.equal(run("[0, 6, 12, 18, 24].map(i => allChars[i]).join('')"), 'FFFFF');
    assert.equal(run('allChars[1]'), 'Q');
    assert.equal(run('moves'), 1);
    assert.equal(run('selectedTiles.size'), 0);
    for (const index of [0, 6, 12, 18, 24]) assert.equal(elements.game.children[index].textContent, 'F');
});

test('selection is capped at five and deselecting updates controls and tile state', () => {
    const { run, board, elements } = setup();
    board({ 0:'D', 1:'F', 2:'H', 3:'I', 4:'M' });
    run('[0, 1, 2, 3, 4, 5].forEach(selectTile)');
    assert.equal(run('selectedTiles.size'), 5);
    assert.equal(run('selectedTiles.has(5)'), false);
    assert.equal(elements.game.children[0].attributes['aria-pressed'], 'true');
    run('selectTile(0)');
    assert.equal(run('selectedTiles.size'), 4);
    assert.equal(elements.replace.disabled, true);
    assert.equal(elements.game.children[0].attributes['aria-pressed'], 'false');
    run('selectTile(5)');
    assert.equal(run('selectedTiles.size'), 5);
    run('startGame()');
    assert.equal(run('selectedTiles.size'), 0);
});

test('identical or adjacent bounds have no replacement options', () => {
    for (const letters of ['DDDDD', 'DDEEE']) {
        const { run, board, elements } = setup();
        board(Object.fromEntries([...letters].map((letter, index) => [index, letter])));
        run('[0, 1, 2, 3, 4].forEach(selectTile)');
        assert.equal(elements.replace.disabled, true);
        run("replaceAllWithChar('E')");
        assert.equal(run('moves'), 0);
    }
});

test('shared score includes the game URL in the fallback text', async () => {
    const { run, elements } = setup();
    await run('share()');
    assert.match(elements.shareStatus.textContent, /WordEntropy: 0 points, 0 words, 0 moves/);
    assert.ok(elements.shareStatus.textContent.includes('https://www.isageek.com.br/wordEntropy/'));
});
