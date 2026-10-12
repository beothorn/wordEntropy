const wordSize = 5;
const minimumWordLength = 4;
const requiredSelectionCount = 5;
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const byId = id => document.getElementById(id);
let allChars = [];
const selectedTiles = new Set();
let wordsFound = new Set();
let score = 0;
let moves = 0;
let ended = false;
const cells = [];
function getRandomChar() { return chars[Math.floor(Math.random() * chars.length)]; }

// Lines 0–4 are rows (left to right); lines 5–9 are columns (top to bottom).
// Each line uses three Set lookups, independent of dictionary size.
const allLines = Array.from({ length: wordSize * 2 }, (_, line) => line);
function findLineWords(board, line) {
    const vertical = line >= wordSize;
    const origin = vertical ? line - wordSize : line * wordSize;
    const step = vertical ? wordSize : 1;
    let letters = '';
    for (let i = 0; i < wordSize; i++) letters += board[origin + i * step];
    const matches = [];
    for (let start = 0; start <= wordSize - minimumWordLength; start++) {
        for (let length = minimumWordLength; start + length <= wordSize; length++) {
            const word = letters.slice(start, start + length);
            if (words.has(word)) matches.push({ word, start: origin + start * step, length, step });
        }
    }
    return matches;
}
function findRowWords(board, row) { return findLineWords(board, row); }
function findColumnWords(board, column) { return findLineWords(board, wordSize + column); }
function linesForTiles(indices) {
    const lines = new Set();
    for (const index of indices) {
        lines.add(Math.floor(index / wordSize));
        lines.add(wordSize + index % wordSize);
    }
    return lines;
}
function removeStartingWords(board, randomLetter = getRandomChar) {
    // Cache each line's matches. A reroll can create a perpendicular word, so
    // invalidate both the row and the column of every changed tile.
    const matchesByLine = new Map();
    let dirty = new Set(allLines);
    for (let attempt = 0; attempt < 64; attempt++) {
        for (const line of dirty) matchesByLine.set(line, findLineWords(board, line));
        const affected = new Set();
        for (const matches of matchesByLine.values()) {
            for (const match of matches) {
                for (let i = 0; i < match.length; i++) affected.add(match.start + i * match.step);
            }
        }
        if (!affected.size) return board;
        for (const index of affected) board[index] = randomLetter();
        dirty = linesForTiles(affected);
    }
    // Check the last reroll before falling back. Bound generation even if the
    // random source keeps producing words. Verify the entire fallback board.
    if (!allLines.some(line => findLineWords(board, line).length)) return board;
    for (const letter of chars) {
        const fallback = Array(board.length).fill(letter);
        if (!allLines.some(line => findLineWords(fallback, line).length)) {
            board.splice(0, board.length, ...fallback);
            return board;
        }
    }
    throw new Error('Dictionary has no safe fallback board.');
}
function setStatus(message) { byId('status').textContent = message; }
function deselectAll() { selectedTiles.clear(); }
function selectedLetterRange() {
    const letters = [...selectedTiles].map(index => allChars[index]).sort();
    return [letters[0], letters[letters.length - 1]];
}
function updateAvailableChars() {
    const selector = byId('charSelector');
    selector.replaceChildren();
    const [smallest, biggest] = selectedLetterRange();
    if (selectedTiles.size === requiredSelectionCount && !ended) {
        for (const letter of chars) {
            if (letter > smallest && letter < biggest) {
                const option = document.createElement('option');
                option.value = option.textContent = letter;
                selector.appendChild(option);
            }
        }
    }
    selector.disabled = ended || !selector.options.length;
    if (selector.disabled) {
        const placeholder = document.createElement('option');
        placeholder.textContent = '—'; placeholder.value = '';
        selector.appendChild(placeholder);
    }
    byId('replace').disabled = selector.disabled;
    cells.forEach((cell, index) => {
        const selected = selectedTiles.has(index);
        cell.classList.toggle('selected', selected);
        cell.setAttribute('aria-pressed', String(selected));
    });
    if (!ended) setStatus(selectedTiles.size < requiredSelectionCount
        ? `Select ${requiredSelectionCount} tiles (${selectedTiles.size}/${requiredSelectionCount}).`
        : selector.disabled ? 'No letter lies between the smallest and biggest letters. Deselect a tile to try another selection.'
        : `Replace all ${requiredSelectionCount} tiles with a letter strictly between ${smallest} and ${biggest}.`);
}
function selectTile(index) {
    if (ended || !Number.isInteger(index) || index < 0 || index >= cells.length) return;
    if (selectedTiles.has(index)) selectedTiles.delete(index);
    else if (selectedTiles.size < requiredSelectionCount) selectedTiles.add(index);
    updateAvailableChars();
}

function updateStats() {
    byId('score').textContent = score;
    byId('wordCount').textContent = wordsFound.size;
    byId('moveCount').textContent = moves;
}
function checkForWords(lines = allLines) {
    if (ended) return [];
    const discovered = [];
    for (const line of new Set(lines)) {
        for (const { word } of findLineWords(allChars, line)) {
            if (wordsFound.has(word)) continue;
            wordsFound.add(word); discovered.push(word); score += word.length;
            const li = document.createElement('li');
            li.textContent = `${word} +${word.length}`;
            byId('wordsFound').appendChild(li);
        }
    }
    updateStats();
    return discovered;
}
function replaceAllWithChar(key) {
    if (ended || !/^[A-Z]$/.test(key) || selectedTiles.size !== requiredSelectionCount) return;
    const [smallest, biggest] = selectedLetterRange();
    if (key <= smallest || key >= biggest) return;
    const lines = linesForTiles(selectedTiles);
    for (const index of selectedTiles) {
        allChars[index] = key;
        cells[index].textContent = key;
        cells[index].setAttribute('aria-label', `${key}, row ${Math.floor(index / wordSize) + 1}, column ${index % wordSize + 1}`);
        cells[index].classList.remove('changed');
        cells[index].classList.add('changed');
    }
    moves++;
    deselectAll(); updateAvailableChars();
    const found = checkForWords(lines); // Only rows and columns containing selected tiles.
    setStatus(found.length ? `Found ${found.join(', ')}.` : '');
}
function replaceAllWithSelectedChar() { replaceAllWithChar(byId('charSelector').value); }
function showHelp() { byId('helpDialog').showModal(); }
function hideHelp() { byId('helpDialog').close(); }
function closeScore() { byId('scoreDialog').close(); }
function endGame() {
    if (ended) return;
    ended = true; deselectAll(); updateAvailableChars();
    cells.forEach(cell => { cell.disabled = true; });
    byId('end').hidden = true; byId('restart').hidden = false;
    byId('finalScore').textContent = score;
    byId('finalWords').textContent = wordsFound.size;
    byId('finalMoves').textContent = moves;
    byId('shareStatus').textContent = '';
    setStatus('Game complete.');
    byId('scoreDialog').showModal();
}
function startGame() {
    const replaying = byId('scoreDialog').open || ended;
    if (byId('scoreDialog').open) closeScore();
    ended = false; wordsFound = new Set(); score = moves = 0; deselectAll();
    allChars = removeStartingWords(Array.from({ length: wordSize * wordSize }, getRandomChar));
    byId('wordsFound').replaceChildren();
    cells.forEach((cell, index) => {
        cell.textContent = allChars[index]; cell.disabled = false; cell.classList.remove('changed');
        cell.setAttribute('aria-label', `${allChars[index]}, row ${Math.floor(index / wordSize) + 1}, column ${index % wordSize + 1}`);
    });
    byId('end').hidden = false; byId('restart').hidden = true;
    updateStats(); updateAvailableChars();
    if (replaying) cells[0].focus();
}
async function share() {
    const text = `WordEntropy: ${score} points, ${wordsFound.size} words, ${moves} moves${ended ? ' — game complete' : ''}.\nhttps://www.isageek.com.br/wordEntropy/`;
    const report = message => { setStatus(message); byId('shareStatus').textContent = message; };
    try {
        if (navigator.share) await navigator.share({ title: 'WordEntropy', text });
        else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text); report('Score copied to clipboard.');
        } else report(text);
    } catch (error) { if (error.name !== 'AbortError') report(text); }
}
for (let index = 0; index < wordSize * wordSize; index++) {
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell';
    cell.addEventListener('click', () => selectTile(index));
    cell.addEventListener('animationend', () => cell.classList.remove('changed'));
    cells.push(cell); byId('game').appendChild(cell);
}
document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || byId('helpDialog').open || byId('scoreDialog').open) return;
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (/^[a-z]$/i.test(event.key)) replaceAllWithChar(event.key.toUpperCase());
});
byId('scoreDialog').addEventListener('close', () => { if (ended) byId('restart').focus(); });
byId('selectionCount').textContent = requiredSelectionCount;
startGame();
