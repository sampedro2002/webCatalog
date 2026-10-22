(() => {
    "use strict";

    const API_URL = "https://rickandmortyapi.com/api";
    const GRAPHQL_URL = "https://rickandmortyapi.com/graphql";
    const SEARCH_DELAY = 4000;
    // With an empty search box (the start screen) only this many cards are shown, picked at random.
    const INITIAL_LIMIT = 20;
    // NOTE (join): one GraphQL request searches characters, locations and episodes at once,
    // and each result already carries its relations (character -> episodes -> characters,
    // location -> residents, episode -> characters). The REST API would need one request per
    // relation. We send it as GET with the query in the URL, because the project rule forbids
    // POST against rickandmortyapi.com.
    const PAGE_INFO = "info { pages count next prev }";
    const SEARCH_QUERY = `query ($name: String, $page: Int) {
        characters(page: $page, filter: { name: $name }) {
            ${PAGE_INFO}
            results {
                id name status species type gender image created
                origin { id name residents { id } }
                location { id name }
                episode { id name episode air_date characters { id } }
            }
        }
        locations(page: $page, filter: { name: $name }) {
            ${PAGE_INFO}
            results { id name type dimension created residents { id name } }
        }
        episodes(page: $page, filter: { name: $name }) {
            ${PAGE_INFO}
            results { id name episode air_date created characters { id name } }
        }
    }`;
    const kinds = {
        character: { title: "Character", root: "characters" },
        location: { title: "Location", root: "locations" },
        episode: { title: "Episode", root: "episodes" },
    };
    const grid = document.getElementById("grid");
    const message = document.getElementById("message");
    const spinner = document.getElementById("spinner");
    const search = document.getElementById("searchInput");
    const previous = document.getElementById("previous");
    const next = document.getElementById("next");
    const pageInfo = document.getElementById("pageInfo");
    const retry = document.getElementById("retry");
    const characterDialog = document.getElementById("characterDialog");
    const characterDetails = document.getElementById("characterDetails");
    const restore = document.getElementById("restore");
    let dialogTrigger;
    let page = 1;
    let timer;
    let controller;
    let version = 0;
    // Last page the API returned, kept so a logical delete can re-render without refetching.
    let lastData = null;

    // LOGICAL DELETE: the Rick and Morty API is read-only (GET only; no DELETE/PUT/POST),
    // so "Delete" never touches rickandmortyapi.com. It only hides the item in this app,
    // in this browser. Anyone querying the API directly will still see the item.
    // IDs are tracked per kind (character #1 and location #1 are different items)
    // and always stored as strings, so compare with String(item.id).
    const STORAGE_KEY = "rickMorty.deletedIds";
    // localStorage keeps items hidden across reloads. Alternatives:
    // - sessionStorage: same API, but the list is cleared when the tab is closed.
    //   const storage = window.sessionStorage;
    // - Backend: persist the list per user, e.g. POST /api/hidden-items { kind, id }
    //   and GET /api/hidden-items on load, so it follows the user across devices.
    const storage = (() => {
        try { return window.localStorage; } catch { return null; }
    })();

    function readDeleted() {
        let saved = {};
        try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "{}"); } catch { /* corrupt or blocked: start empty */ }
        return Object.fromEntries(Object.keys(kinds)
            .map(kind => [kind, new Set((Array.isArray(saved[kind]) ? saved[kind] : []).map(String))]));
    }

    const deleted = readDeleted();

    function saveDeleted() {
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(
                Object.entries(deleted).map(([kind, ids]) => [kind, [...ids]]))));
        } catch {
            // Storage full or blocked: items stay hidden only until the page is reloaded.
        }
    }

    function deletedCount() {
        return Object.values(deleted).reduce((total, ids) => total + ids.size, 0);
    }

    // The API keeps returning references to hidden items inside related records
    // (episode.characters, location.residents, character.episode). Joined references come
    // back as objects ({ id }); run those arrays through here so a deleted Morty does not
    // reappear inside an episode or location.
    function filtrarReferencias(array, kind) {
        return (array || []).filter(ref => !deleted[kind].has(String(ref.id)));
    }

    // General filtering step: first the search filters, then the logical deletes.
    // filtros = { nombre: "rick", tipo?: "character" | "location" | "episode" }
    // Without tipo, each item is checked against the deleted list of its own kind (item.kind),
    // so one call can filter a mixed list.
    function aplicarFiltros(items, filtros) {
        const nombre = (filtros.nombre || "").toLowerCase();
        return items
            .filter(item => !nombre || item.name.toLowerCase().includes(nombre))
            .filter(item => !deleted[filtros.tipo || item.kind].has(String(item.id)));
    }

    function eliminarLogicamente(id, kind) {
        deleted[kind].add(String(id));
        saveDeleted();
        render();
    }

    function restaurarEliminados() {
        Object.values(deleted).forEach(ids => ids.clear());
        saveDeleted();
        render();
    }

    function cancelPending() {
        clearTimeout(timer);
        controller?.abort();
        version += 1;
        previous.disabled = true;
        next.disabled = true;
        retry.hidden = true;
    }

    function showMessage(text) {
        message.textContent = text;
        message.hidden = !text;
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
    }

    function deleteButton(item) {
        const actions = element("div", "card__actions", "");
        const button = element("button", "btn btn--danger", "Delete");
        button.type = "button";
        button.setAttribute("aria-label", `Delete ${item.name} from this list`);
        button.addEventListener("click", () => eliminarLogicamente(item.id, item.kind));
        actions.append(button);
        return actions;
    }

    function createCard(item) {
        const card = element("article", "card", "");
        const label = kinds[item.kind].title;
        // The details trigger and the Delete button are siblings: buttons cannot be nested.
        const open = element("button", "character-card", "");
        open.type = "button";
        open.setAttribute("aria-label", `View details for ${label} #${item.id}: ${item.name}`);
        open.setAttribute("aria-haspopup", "dialog");
        open.addEventListener("click", () => openDetails(item, open));
        if (item.kind === "character") {
            const image = document.createElement("img");
            image.className = "card__image";
            image.src = item.image;
            image.alt = item.name;
            image.loading = "lazy";
            image.addEventListener("error", () => { image.hidden = true; });
            open.append(image);
            open.append(element("span", "card__badge", `Character #${item.id}`));
        } else {
            open.classList.add("detail-card");
            const body = element("div", "card__body", "");
            body.append(element("span", "card__badge", `${label} · #${item.id}`));
            body.append(element("h3", "card__name", item.name));
            const details = item.kind === "location"
                    ? [`Type: ${item.type || "Unknown"}`, `Dimension: ${item.dimension}`, `Residents: ${filtrarReferencias(item.residents, "character").length}`]
                    : [`Code: ${item.episode}`, `Air date: ${item.air_date}`, `Characters: ${filtrarReferencias(item.characters, "character").length}`];
            details.forEach(text => body.append(element("p", "card__description", text)));
            open.append(body);
        }
        card.append(open, deleteButton(item));
        return card;
    }

    function apiLink(url, label) {
        if (!url) return element("span", "", label || "Unknown");
        const link = element("a", "", label);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return link;
    }

    function fieldList(rows) {
        const fields = element("dl", "character-fields", "");
        rows.forEach(([label, value]) => {
            const description = element("dd", "", "");
            if (typeof value === "object") description.append(value);
            else description.textContent = String(value ?? "Unknown");
            fields.append(element("dt", "", label), description);
        });
        return fields;
    }

    // Heading plus a list of related items (deleted ones are left out).
    function relatedList(heading, refs, kind, text) {
        const visible = filtrarReferencias(refs, kind);
        const list = element("ul", "character-episodes", "");
        visible.forEach(ref => {
            const row = element("li", "", "");
            row.append(apiLink(`${API_URL}/${kind}/${ref.id}`, text(ref)));
            list.append(row);
        });
        return [element("h3", "", `${heading} (${visible.length})`), list];
    }

    function characterDetailsView(item) {
        const image = document.createElement("img");
        image.className = "character-portrait";
        image.src = item.image;
        image.alt = item.name;
        image.addEventListener("error", () => { image.hidden = true; });
        const fields = fieldList([
            ["ID", item.id], ["Name", item.name], ["Status", item.status],
            ["Species", item.species], ["Type", item.type || "Not specified"],
            ["Gender", item.gender],
            ["Origin", apiLink(item.origin.url, item.origin.name)],
            ["Location", apiLink(item.location.url, item.location.name)],
            ["Residents in origin", filtrarReferencias(item.origin.residents, "character").length],
            ["Created", item.created],
            ["Image", apiLink(item.image, "View original image")],
            ["API record", apiLink(item.url, `Character #${item.id}`)],
        ]);
        const episodes = relatedList("Episodes", item.episode, "episode", episode =>
            `${episode.episode} · ${episode.name} (${filtrarReferencias(episode.characters, "character").length} characters)`);
        return [image, fields, ...episodes];
    }

    function locationDetailsView(item) {
        const fields = fieldList([
            ["ID", item.id], ["Name", item.name], ["Type", item.type || "Not specified"],
            ["Dimension", item.dimension], ["Created", item.created],
            ["API record", apiLink(item.url, `Location #${item.id}`)],
        ]);
        return [fields, ...relatedList("Residents", item.residents, "character", resident => resident.name)];
    }

    function episodeDetailsView(item) {
        const fields = fieldList([
            ["ID", item.id], ["Name", item.name], ["Code", item.episode],
            ["Air date", item.air_date], ["Created", item.created],
            ["API record", apiLink(item.url, `Episode #${item.id}`)],
        ]);
        return [fields, ...relatedList("Characters", item.characters, "character", character => character.name)];
    }

    const detailViews = { character: characterDetailsView, location: locationDetailsView, episode: episodeDetailsView };

    function openDetails(item, trigger) {
        dialogTrigger = trigger;
        document.getElementById("characterTitle").textContent = item.name;
        characterDetails.replaceChildren(...detailViews[item.kind](item));
        characterDialog.showModal();
    }

    document.getElementById("closeCharacter").addEventListener("click", () => characterDialog.close());
    characterDialog.addEventListener("click", event => {
        if (event.target !== characterDialog) return;
        const bounds = characterDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) characterDialog.close();
    });
    characterDialog.addEventListener("close", () => dialogTrigger?.focus());

    function setLoading(loading) {
        spinner.hidden = !loading;
        grid.setAttribute("aria-busy", String(loading));
    }

    // Adds the kind and the REST-style URL the details dialog links to.
    function toItem(raw, kind) {
        const item = { ...raw, kind, url: `${API_URL}/${kind}/${raw.id}` };
        if (kind === "character") {
            item.origin = { ...raw.origin, url: raw.origin?.id ? `${API_URL}/location/${raw.origin.id}` : "" };
            item.location = { ...raw.location, url: raw.location?.id ? `${API_URL}/location/${raw.location.id}` : "" };
        }
        return item;
    }

    // Fisher-Yates shuffle, in place.
    function shuffle(list) {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    // One request, three searches. Resolves to null when nothing matches.
    // Result: { info: { pages, count, next, prev }, results: [item, ...] } with every item tagged by kind.
    async function fetchSearch(page, name) {
        const url = new URL(GRAPHQL_URL);
        url.searchParams.set("query", SEARCH_QUERY);
        url.searchParams.set("variables", JSON.stringify({ name, page }));
        const current = new AbortController();
        controller = current;
        const timeout = setTimeout(() => current.abort(), 15000);
        try {
            const response = await fetch(url, { signal: current.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { data, errors } = await response.json();
            if (!data) throw new Error(errors?.[0]?.message || "GraphQL error");
            const groups = Object.entries(kinds).map(([kind, { root }]) => data[root]);
            // Shuffled once per request, so characters, locations and episodes come out mixed
            // and re-rendering after a delete keeps the same order.
            const results = shuffle(Object.keys(kinds).flatMap((kind, index) =>
                (groups[index]?.results || []).map(raw => toItem(raw, kind))));
            if (!results.length) return null;
            // A kind that ran out of pages answers with empty results and null info.
            const infos = groups.map(group => group?.info || {});
            return {
                info: {
                    pages: Math.max(...infos.map(info => info.pages || 0)),
                    count: infos.reduce((total, info) => total + (info.count || 0), 0),
                    next: infos.some(info => info.next) ? page + 1 : null,
                    prev: page > 1 ? page - 1 : null,
                },
                results,
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    async function load() {
        cancelPending();
        const requestVersion = version;
        lastData = null;
        grid.replaceChildren();
        setLoading(true);
        pageInfo.textContent = "";
        showMessage("Loading...");
        try {
            const name = search.value.trim();
            const data = await fetchSearch(page, name);
            if (requestVersion !== version) return;
            if (!data) {
                showMessage("No results found for that name.");
                return;
            }
            lastData = { name, data };
            render();
            previous.disabled = !data.info.prev;
            next.disabled = !data.info.next;
        } catch (error) {
            if (requestVersion !== version) return;
            showMessage(error.name === "AbortError"
                ? "The request timed out. Please try again."
                : "Could not load Rick and Morty data. Check your connection and try again.");
            retry.hidden = false;
        } finally {
            if (requestVersion === version) setLoading(false);
        }
    }

    // NOTE (pagination): the API pages 20 items at a time per kind (the same page number is
    // asked for characters, locations and episodes) and logical deletes are filtered
    // client-side after each page arrives, so a page can show fewer cards, or none when every
    // item on it was deleted. We accept shorter pages to keep one request per page and the
    // API's own page numbers. TODO: to always show full pages, fetch pages sequentially,
    // filter, and paginate the filtered list in the UI instead.
    function render() {
        const count = deletedCount();
        restore.hidden = count === 0;
        restore.textContent = `Restore deleted (${count})`;
        if (!lastData) return;
        const { name, data } = lastData;
        const focusIndex = grid.children.length
            ? [...grid.children].findIndex(card => card.contains?.(document.activeElement)) : -1;
        const filtered = aplicarFiltros(data.results, { nombre: name });
        const visible = name ? filtered : filtered.slice(0, INITIAL_LIMIT);
        grid.replaceChildren(...visible.map(createCard));
        const hidden = data.results.length - filtered.length;
        showMessage(visible.length ? ""
            : hidden ? "Every item on this page was deleted. Try another page or restore them."
            : "No results found.");
        pageInfo.textContent = `Page ${page} of ${data.info.pages} · ${data.info.count} results`
            + (hidden ? ` · ${hidden} hidden on this page` : "");
        // Keep keyboard focus in the list when the focused card disappears.
        if (focusIndex >= 0) {
            const target = grid.children[Math.min(focusIndex, grid.children.length - 1)];
            (target?.querySelector(".btn--danger") || (restore.hidden ? search : restore)).focus();
        }
    }

    search.addEventListener("input", () => {
        cancelPending();
        lastData = null;
        page = 1;
        grid.replaceChildren();
        setLoading(true);
        pageInfo.textContent = "";
        showMessage("Loading...");
        timer = setTimeout(load, SEARCH_DELAY);
    });

    previous.addEventListener("click", () => { if (!previous.disabled) { page -= 1; load(); } });
    next.addEventListener("click", () => { if (!next.disabled) { page += 1; load(); } });
    retry.addEventListener("click", load);
    restore.addEventListener("click", restaurarEliminados);
    render();
    load();
})();
