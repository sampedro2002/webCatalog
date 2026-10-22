(() => {
    "use strict";

    const API_URL = "https://rickandmortyapi.com/api";
    const SEARCH_DELAY = 4000;
    const resources = {
        character: { title: "Characters", example: "e.g. Rick Sanchez" },
        location: { title: "Locations", example: "e.g. Earth" },
        episode: { title: "Episodes", example: "e.g. Pilot" },
    };
    const grid = document.getElementById("grid");
    const message = document.getElementById("message");
    const spinner = document.getElementById("spinner");
    const search = document.getElementById("searchInput");
    const previous = document.getElementById("previous");
    const next = document.getElementById("next");
    const pageInfo = document.getElementById("pageInfo");
    const retry = document.getElementById("retry");
    const buttons = document.querySelectorAll("[data-resource]");
    const characterDialog = document.getElementById("characterDialog");
    const characterDetails = document.getElementById("characterDetails");
    let characterTrigger;
    let resource = "character";
    let page = 1;
    let timer;
    let controller;
    let version = 0;

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

    function createCard(item, kind) {
        const card = element(kind === "character" ? "button" : "article", "card", "");
        if (kind === "character") {
            card.type = "button";
            card.className = "card character-card";
            card.setAttribute("aria-label", `View details for Character #${item.id}: ${item.name}`);
            card.setAttribute("aria-haspopup", "dialog");
            const image = document.createElement("img");
            image.className = "card__image";
            image.src = item.image;
            image.alt = item.name;
            image.loading = "lazy";
            image.addEventListener("error", () => { image.hidden = true; });
            card.append(image);
            card.append(element("span", "card__badge", `Character #${item.id}`));
            card.addEventListener("click", () => openCharacter(item, card));
            return card;
        }
        const body = element("div", "card__body", "");
        body.append(element("span", "card__badge", `${resources[kind].title} · #${item.id}`));
        body.append(element("h3", "card__name", item.name));
        const details = kind === "location"
                ? [`Type: ${item.type || "Unknown"}`, `Dimension: ${item.dimension}`, `Residents: ${item.residents.length}`]
                : [`Code: ${item.episode}`, `Air date: ${item.air_date}`, `Characters: ${item.characters.length}`];
        details.forEach(text => body.append(element("p", "card__description", text)));
        card.append(body);
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

    function openCharacter(item, trigger) {
        characterTrigger = trigger;
        document.getElementById("characterTitle").textContent = item.name;
        const image = document.createElement("img");
        image.className = "character-portrait";
        image.src = item.image;
        image.alt = item.name;
        image.addEventListener("error", () => { image.hidden = true; });
        const fields = element("dl", "character-fields", "");
        const rows = [
            ["ID", item.id], ["Name", item.name], ["Status", item.status],
            ["Species", item.species], ["Type", item.type || "Not specified"],
            ["Gender", item.gender],
            ["Origin", apiLink(item.origin.url, item.origin.name)],
            ["Location", apiLink(item.location.url, item.location.name)],
            ["Created", item.created],
            ["Image", apiLink(item.image, "View original image")],
            ["API record", apiLink(item.url, `Character #${item.id}`)],
        ];
        rows.forEach(([label, value]) => {
            const description = element("dd", "", "");
            if (typeof value === "object") description.append(value);
            else description.textContent = String(value ?? "Unknown");
            fields.append(element("dt", "", label), description);
        });
        const episodes = element("ul", "character-episodes", "");
        item.episode.forEach(url => {
            const row = element("li", "", "");
            row.append(apiLink(url, `Episode #${url.split("/").pop()}`));
            episodes.append(row);
        });
        characterDetails.replaceChildren(image, fields,
            element("h3", "", `Episodes (${item.episode.length})`), episodes);
        characterDialog.showModal();
    }

    document.getElementById("closeCharacter").addEventListener("click", () => characterDialog.close());
    characterDialog.addEventListener("click", event => {
        if (event.target !== characterDialog) return;
        const bounds = characterDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) characterDialog.close();
    });
    characterDialog.addEventListener("close", () => characterTrigger?.focus());

    function setLoading(loading) {
        spinner.hidden = !loading;
        grid.setAttribute("aria-busy", String(loading));
    }

    // Resolves to null when the API answers 404 (no matches for the filter).
    async function fetchData(endpoint, page, name) {
        const url = new URL(`${API_URL}/${endpoint}`);
        url.searchParams.set("page", page);
        if (name) url.searchParams.set("name", name);
        const current = new AbortController();
        controller = current;
        const timeout = setTimeout(() => current.abort(), 15000);
        try {
            const response = await fetch(url, { signal: current.signal });
            if (response.status === 404) return null;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    async function load() {
        cancelPending();
        const requestVersion = version;
        const kind = resource;
        grid.replaceChildren();
        setLoading(true);
        pageInfo.textContent = "";
        showMessage("Loading...");
        try {
            const data = await fetchData(kind, page, search.value.trim());
            if (requestVersion !== version) return;
            if (!data) {
                showMessage("No results found for that name.");
                return;
            }
            grid.replaceChildren(...data.results.map(item => createCard(item, kind)));
            showMessage(data.results.length ? "" : "No results found.");
            pageInfo.textContent = `Page ${page} of ${data.info.pages} · ${data.info.count} results`;
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

    search.addEventListener("input", () => {
        cancelPending();
        page = 1;
        grid.replaceChildren();
        setLoading(true);
        pageInfo.textContent = "";
        showMessage("Loading...");
        timer = setTimeout(load, SEARCH_DELAY);
    });

    buttons.forEach(button => button.addEventListener("click", () => {
        if (resource === button.dataset.resource) return;
        resource = button.dataset.resource;
        page = 1;
        search.value = "";
        search.placeholder = resources[resource].example;
        document.getElementById("sectionTitle").textContent = resources[resource].title;
        buttons.forEach(tab => {
            const active = tab === button;
            tab.classList.toggle("btn--primary", active);
            tab.setAttribute("aria-pressed", String(active));
        });
        load();
    }));
    previous.addEventListener("click", () => { if (!previous.disabled) { page -= 1; load(); } });
    next.addEventListener("click", () => { if (!next.disabled) { page += 1; load(); } });
    retry.addEventListener("click", load);
    load();
})();
