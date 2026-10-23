// Live API smoke test with a minimal DOM harness (not a browser layout test).
// Run: node --test frontend/tests/rick-morty.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

class Element {
    constructor() {
        this.children = [];
        this.listeners = {};
        this.attributes = {};
        this.value = '';
        this.className = '';
        this.classList = { toggle() {}, add: name => { this.className += ` ${name}`; } };
    }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    dispatch(event) { this.listeners[event](); }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    focus() { this.focused = true; }
}

test('unified mixed search (join), 20-card start screen, details pop-ups, pagination, 4-second debounce, empty results, stale responses and logical delete', async () => {
    const nodes = new Map();
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, new Element());
        return nodes.get(id);
    };
    const timers = new Map();
    const calls = [];
    const stored = new Map();
    let clock = 0;
    let timerId = 0;
    const context = {
        URL, AbortController, Math,
        window: {
            localStorage: {
                getItem: key => stored.get(key) ?? null,
                setItem: (key, value) => stored.set(key, value),
            },
        },
        document: {
            getElementById: get,
            createElement: () => new Element(),
        },
        setTimeout(callback, delay) {
            timers.set(++timerId, { callback, at: clock + delay });
            return timerId;
        },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) {
            calls.push(decodeURIComponent(String(url)));
            return fetch(url, { signal: AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) });
        },
    };
    function advance(ms) {
        clock += ms;
        for (const [id, timer] of timers) {
            if (timer.at <= clock) {
                timers.delete(id);
                timer.callback();
            }
        }
    }
    async function settled() {
        const deadline = Date.now() + 16000;
        while (get('grid').attributes['aria-busy'] === 'true') {
            if (Date.now() > deadline) throw new Error('Request did not settle');
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(get('retry').hidden, true, get('message').textContent);
    }

    // Card helpers. A card is [open button, actions]; the badge sits in the button (characters)
    // or in its body (locations and episodes).
    const cards = () => get('grid').children;
    const isDetailCard = card => card.children[0].className.includes('detail-card');
    const badge = card => (isDetailCard(card)
        ? card.children[0].children[0].children[0] : card.children[0].children[1]).textContent;
    const cardOf = text => cards().find(card => badge(card) === text);
    const firstOfKind = prefix => cards().find(card => badge(card).startsWith(prefix));
    const openCard = card => card.children[0].dispatch('click');
    const deleteCard = card => card.children[1].children[0].dispatch('click');
    const dialogLabels = dl => dl.children.filter((_, index) => index % 2 === 0).map(field => field.textContent);
    // Types in the search box and waits for the debounce and the response.
    async function searchFor(text) {
        get('searchInput').value = text;
        get('searchInput').dispatch('input');
        advance(4000);
        await settled();
    }

    vm.runInNewContext(readFileSync(require.resolve('../js/rick-morty.js'), 'utf8'), context);
    await settled();

    // Start screen: one GraphQL request, only 20 cards, with several kinds mixed together.
    assert.equal(calls.length, 1);
    assert.match(calls[0], /graphql/);
    assert.equal(cards().length, 20);
    assert.ok(cards().some(card => !isDetailCard(card)), 'Characters are in the start screen');
    assert.ok(cards().some(card => isDetailCard(card)), 'Locations or episodes are in the start screen');

    // Pagination moves all three lists to the same page.
    assert.equal(get('previous').disabled, true);
    get('next').dispatch('click');
    await settled();
    assert.match(calls.at(-1), /"page":2/);
    assert.equal(get('previous').disabled, false);
    assert.equal(cards().length, 20);

    const beforeSearch = calls.length;
    get('searchInput').value = 'ric';
    get('searchInput').dispatch('input');
    advance(3999);
    assert.equal(calls.length, beforeSearch);
    get('searchInput').value = 'rick';
    get('searchInput').dispatch('input');
    advance(3999);
    assert.equal(calls.length, beforeSearch);
    advance(1);
    await settled();
    assert.equal(calls.length, beforeSearch + 1);
    assert.match(calls.at(-1), /"name":"rick","page":1/);

    // A search is not limited to 20 cards and returns the three kinds in one mixed list.
    assert.ok(cards().length > 20, 'A search shows every match');
    assert.ok(cardOf('Character #1'), 'Rick Sanchez matches "rick"');
    assert.ok(firstOfKind('Location'), 'Locations match "rick" too');
    assert.ok(firstOfKind('Episode'), 'Episodes match "rick" too');
    const kindsInOrder = cards().map(card => badge(card).split(/[ #·]/)[0]);
    assert.ok(kindsInOrder.some((kind, index) => index > 0 && kind !== kindsInOrder[index - 1]), 'Kinds are mixed');

    // Character pop-up.
    const rick = cardOf('Character #1');
    assert.equal(rick.children[0].children.length, 2, 'Character card only contains the image and ID');
    openCard(rick);
    assert.equal(get('characterDialog').open, true);
    assert.equal(get('characterTitle').textContent, 'Rick Sanchez');
    const characterView = get('characterDetails').children;
    assert.deepEqual(dialogLabels(characterView[1]),
        ['ID', 'Name', 'Status', 'Species', 'Type', 'Gender', 'Origin', 'Location', 'Residents in origin', 'Created', 'Image', 'API record']);
    assert.ok(characterView[3].children.length > 0, 'Episodes are listed');
    get('closeCharacter').dispatch('click');
    assert.equal(get('characterDialog').open, false);
    assert.equal(rick.children[0].focused, true);

    // Location pop-up.
    openCard(firstOfKind('Location'));
    assert.equal(get('characterDialog').open, true);
    assert.deepEqual(dialogLabels(get('characterDetails').children[0]),
        ['ID', 'Name', 'Type', 'Dimension', 'Created', 'API record']);
    assert.match(get('characterDetails').children[1].textContent, /^Residents \(\d+\)$/);
    get('closeCharacter').dispatch('click');

    // Episode pop-up.
    openCard(firstOfKind('Episode'));
    assert.deepEqual(dialogLabels(get('characterDetails').children[0]),
        ['ID', 'Name', 'Code', 'Air date', 'Created', 'API record']);
    assert.match(get('characterDetails').children[1].textContent, /^Characters \(\d+\)$/);
    get('closeCharacter').dispatch('click');

    // The Pilot lists 19 characters, including Rick.
    await searchFor('pilot');
    openCard(cardOf('Episode · #1'));
    assert.equal(get('characterTitle').textContent, 'Pilot');
    assert.equal(get('characterDetails').children[1].textContent, 'Characters (19)');
    get('closeCharacter').dispatch('click');

    // Logical delete hides the item locally and persists the ID as a string.
    await searchFor('rick');
    const matches = cards().length;
    deleteCard(cardOf('Character #1'));
    assert.equal(cards().length, matches - 1);
    assert.equal(cardOf('Character #1'), undefined);
    assert.deepEqual(JSON.parse(stored.get('rickMorty.deletedIds')).character, ['1']);
    assert.equal(get('restore').hidden, false);
    assert.match(get('pageInfo').textContent, /1 hidden on this page/);

    // The join respects the delete: the Pilot no longer lists the deleted character.
    await searchFor('pilot');
    openCard(cardOf('Episode · #1'));
    assert.equal(get('characterDetails').children[1].textContent, 'Characters (18)');
    get('closeCharacter').dispatch('click');

    // No matches in any of the three lists.
    await searchFor('zzzz-no-such-thing-937194');
    assert.equal(cards().length, 0);
    assert.match(get('message').textContent, /No results found/);
    assert.equal(get('next').disabled, true);

    // A newer search aborts the one still in flight.
    get('searchInput').value = 'summer';
    get('searchInput').dispatch('input');
    advance(4000);
    get('searchInput').value = 'morty';
    get('searchInput').dispatch('input');
    advance(4000);
    await settled();
    assert.match(calls.at(-1), /"name":"morty"/);
    assert.ok(cards().length > 0);
    assert.ok(cards().every(card => /morty/i.test(card.children[0].attributes['aria-label'])));

    get('restore').dispatch('click');
    assert.equal(get('restore').hidden, true);
    assert.deepEqual(JSON.parse(stored.get('rickMorty.deletedIds')).character, []);
});
