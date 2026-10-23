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
        this.dataset = {};
        this.classList = { toggle() {} };
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

test('three resources, pagination, 4-second debounce, empty results and stale responses', async () => {
    const nodes = new Map();
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, new Element());
        return nodes.get(id);
    };
    const buttons = ['character', 'location', 'episode'].map(resource => {
        const button = new Element();
        button.dataset.resource = resource;
        return button;
    });
    const timers = new Map();
    const calls = [];
    let clock = 0;
    let timerId = 0;
    const context = {
        URL, AbortController,
        document: {
            getElementById: get,
            querySelectorAll: () => buttons,
            createElement: () => new Element(),
        },
        setTimeout(callback, delay) {
            timers.set(++timerId, { callback, at: clock + delay });
            return timerId;
        },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) {
            calls.push(String(url));
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

    vm.runInNewContext(readFileSync(require.resolve('../js/rick-morty.js'), 'utf8'), context);
    await settled();
    assert.ok(get('grid').children.length > 0);
    const character = get('grid').children[0];
    assert.equal(character.children.length, 2, 'Card only contains the image and ID');
    assert.equal(character.children[1].textContent, 'Character #1');
    character.dispatch('click');
    assert.equal(get('characterDialog').open, true);
    assert.equal(get('characterTitle').textContent, 'Rick Sanchez');
    const fields = get('characterDetails').children[1].children;
    assert.deepEqual(fields.filter((_, index) => index % 2 === 0).map(field => field.textContent),
        ['ID', 'Name', 'Status', 'Species', 'Type', 'Gender', 'Origin', 'Location', 'Created', 'Image', 'API record']);
    assert.ok(get('characterDetails').children[3].children.length > 0, 'Episodes are listed');
    get('closeCharacter').dispatch('click');
    assert.equal(get('characterDialog').open, false);
    assert.equal(character.focused, true);
    assert.equal(get('previous').disabled, true);
    get('next').dispatch('click');
    await settled();
    assert.match(calls.at(-1), /page=2/);
    assert.equal(get('previous').disabled, false);

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
    assert.match(calls.at(-1), /page=1&name=rick/);
    assert.ok(get('grid').children.length > 0);

    // Switching sections must cancel a search that has not fired yet.
    get('searchInput').value = 'pending';
    get('searchInput').dispatch('input');
    buttons[1].dispatch('click');
    await settled();
    const afterSwitch = calls.length;
    advance(4000);
    assert.equal(calls.length, afterSwitch);
    assert.match(calls.at(-1), /\/location\?/);
    assert.equal(get('searchInput').value, '');
    assert.ok(get('grid').children.length > 0);

    buttons[2].dispatch('click');
    await settled();
    assert.match(calls.at(-1), /\/episode\?/);
    assert.ok(get('grid').children.length > 0);

    get('searchInput').value = 'zzzz-no-such-episode-937194';
    get('searchInput').dispatch('input');
    advance(4000);
    await settled();
    assert.equal(get('grid').children.length, 0);
    assert.match(get('message').textContent, /No results found/);
    assert.equal(get('next').disabled, true);

    // Abort an in-flight request immediately by switching resources.
    buttons[0].dispatch('click');
    buttons[1].dispatch('click');
    await settled();
    assert.equal(get('sectionTitle').textContent, 'Locations');
    assert.match(get('grid').children[0].children[0].children[0].textContent, /Locations/);
});
