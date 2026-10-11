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
    const ids = ['game', 'charSelector', 'replace', 'score', 'wordCount', 'moveCount', 'status', 'wordsFound', 'end', 'restart', 'helpDialog', 'scoreDialog', 'finalScore', 'finalWords', 'finalMoves', 'shareStatus'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    const events = {};
    const context = vm.createContext({ dictionary: wordList, console, navigator: {}, window: { isSecureContext: false }, document: {
        getElementById: id => elements[id], createElement: tag => new Element(tag), addEventListener: (name, callback) => { events[name] = callback; }
    }});
    const run = code => vm.runInContext(code, context);
    run('const words = new Set(dictionary);');
    run(gameSource);
    function board(entries) {
        const board = Array(49).fill('Q');
        for (const [index, letter] of Object.entries(entries)) board[Number(index)] = letter;
        run(`allChars = ${JSON.stringify(board)}; wordsFound.clear(); score = moves = 0;`);
    }
    return { run, elements, board, events };
}

test('bundled dictionary includes CAST and only 4–7-letter words', () => {
    assert.ok(dictionary.includes('CAST'));
    assert.ok(dictionary.every(word => /^[A-Z]{4,7}$/.test(word)));
});

test('vertical CAST scores four points, including with the real dictionary', () => {
    const { run, board, elements } = setup(dictionary);
    board({ 5:'C', 12:'A', 19:'S', 26:'T' });
    run('checkForWords()');
    assert.equal(run("wordsFound.has('CAST')"), true);
    assert.equal(run('score'), 4);
    assert.equal(elements.wordsFound.children[0].textContent, 'CAST +4');
});

test('forming vertical CAST through a replacement immediately awards points', () => {
    const { run, board, elements } = setup();
    board({ 5:'A', 12:'A', 19:'S', 26:'T', 48:'E' });
    run("selectTile(5); selectTile(48); replaceAllWithChar('C');");
    assert.equal(run("wordsFound.has('CAST')"), true);
    assert.equal(run('score'), 4);
    assert.equal(run('moves'), 1);
    assert.equal(elements.score.textContent, 4);
});

test('horizontal CAST scores four points and three-letter CAT does not count', () => {
    const { run, board } = setup();
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 7:'C', 8:'A', 9:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 4);
    assert.equal(run("wordsFound.has('CAT')"), false);
});

test('crossing horizontal and vertical words are both found in one move', () => {
    const { run, board } = setup();
    board({ 0:'A', 1:'A', 2:'S', 3:'T', 7:'O', 14:'L', 21:'D', 48:'E' });
    run("selectTile(0); selectTile(48); replaceAllWithChar('C');");
    assert.equal(run("wordsFound.has('CAST') && wordsFound.has('COLD')"), true);
    assert.equal(run('score'), 8);
    assert.equal(run('wordsFound.size'), 2);
});

test('a word occurring in both directions and on later moves scores only once', () => {
    const { run, board, elements } = setup();
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 7:'A', 14:'S', 21:'T' });
    run('checkForWords(); checkForWords();');
    assert.equal(run('score'), 4);
    assert.equal(run('wordsFound.size'), 1);
    assert.equal(elements.wordsFound.children.length, 1);
});

test('overlapping words and seven-letter words count in either direction', () => {
    const { run, board } = setup();
    board({ 0:'C', 1:'A', 2:'T', 3:'S', 4:'U', 5:'P', 6:'A', 13:'B', 20:'C', 27:'D', 34:'E', 41:'F', 48:'G' });
    run('checkForWords()');
    assert.equal(run('score'), 17); // CATS + CATSUP + ABCDEFG
    assert.equal(run("wordsFound.has('ABCDEFG')"), true);
});

test('seven-letter horizontal words and four-letter words at bottom/right edges count', () => {
    const { run, board } = setup(['ABCDEFG', 'CAST']);
    board({ 0:'A', 1:'B', 2:'C', 3:'D', 4:'E', 5:'F', 6:'G', 45:'C', 46:'A', 47:'S', 48:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 11);
    board({ 27:'C', 34:'A', 41:'S', 48:'T' });
    run('checkForWords()');
    assert.equal(run('score'), 4);
});

test('backwards and diagonal words do not count', () => {
    const { run, board } = setup(['CAST']);
    board({ 0:'T', 1:'S', 2:'A', 3:'C', 6:'T', 13:'S', 20:'A', 27:'C' });
    run('checkForWords()'); assert.equal(run('score'), 0);
    board({ 0:'C', 8:'A', 16:'S', 24:'T' });
    run('checkForWords()'); assert.equal(run('score'), 0);
});

test('words cannot wrap across row boundaries', () => {
    const { run, board } = setup(['WXYZ']);
    board({ 5:'W', 6:'X', 7:'Y', 8:'Z' });
    run('checkForWords()'); assert.equal(run('score'), 0);
});

test('starting-board cleanup removes horizontal and vertical words and deduplicates overlapping tiles', () => {
    const { run, board } = setup(['CAST', 'CASTS']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 4:'S', 7:'A', 14:'S', 21:'T', 48:'Z' });
    run("let rerolls = 0; removeStartingWords(allChars, () => { rerolls++; return 'Q'; });");
    assert.equal(run('rerolls'), 8); // Five horizontal + four vertical - shared C.
    assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
    assert.equal(run('allChars[48]'), 'Z', 'unmatched letters remain untouched');
    assert.equal(run('score'), 0);
});

test('cleanup catches perpendicular words created by rerolling a horizontal word', () => {
    const { run, board } = setup(['CAST', 'COLD']);
    board({ 0:'C', 1:'A', 2:'S', 3:'T', 8:'O', 15:'L', 22:'D' });
    run("let rerolls = 0; removeStartingWords(allChars, () => 'QCQQQQQQ'[rerolls++]);");
    assert.equal(run('rerolls'), 8);
    assert.equal(run('allLines.some(line => findLineWords(allChars, line).length)'), false);
});

test('cleanup has a bounded, verified fallback for a pathological RNG', () => {
    const { run } = setup(['AAAA']);
    run("allChars = Array(49).fill('A'); let rerolls = 0; removeStartingWords(allChars, () => { rerolls++; return 'A'; });");
    assert.equal(run('rerolls'), 49 * 64);
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
    board({ 0:'A', 1:'E' });
    run("let scanned = []; const originalScan = findLineWords; findLineWords = (board, line) => { scanned.push(line); return originalScan(board, line); }; selectTile(0); selectTile(1); replaceAllWithChar('C');");
    assert.equal(run("scanned.sort((a,b) => a-b).join(',')"), '0,7,8');
});

test('replacement rejects endpoints, multi-character keys, and unavailable pairs', () => {
    const { run, board } = setup();
    board({ 0:'A', 1:'E' });
    run("selectTile(0); selectTile(1); replaceAllWithChar('A'); replaceAllWithChar('E'); replaceAllWithChar('ENTER');");
    assert.equal(run('moves'), 0);
    run("replaceAllWithChar('C')");
    assert.equal(run("allChars.slice(0,2).join('')"), 'CC');
    assert.equal(run('moves'), 1);
    assert.equal(run('selected1'), -1);
});

test('end-game modal shows points, blocks moves, and replay resets the game', () => {
    const { run, board, elements } = setup();
    board({ 0:'C', 7:'A', 14:'S', 21:'T' });
    run('checkForWords(); endGame();');
    assert.equal(elements.scoreDialog.open, true);
    assert.equal(elements.finalScore.textContent, 4);
    assert.equal(elements.finalWords.textContent, 1);
    assert.ok(elements.game.children.every(cell => cell.disabled));
    run("allChars[0]='A'; allChars[1]='E'; selectTile(0); selectTile(1); replaceAllWithChar('C');");
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
    board({ 0:'A', 1:'E' });
    run('selectTile(0); selectTile(1); showHelp();');
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
    assert.match(html, /4\+ letters · Horizontal → · Vertical ↓/);
    assert.match(html, /top to bottom/);
    assert.match(html, /Find words before entropy takes over\./);
});
