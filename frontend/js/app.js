const API_URL = "http://localhost:8080/api/products";

const grid = document.getElementById("grid");
const message = document.getElementById("message");
const searchInput = document.getElementById("searchInput");

const navHome = document.getElementById("navHome");
const navProducts = document.getElementById("navProducts");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const productForm = document.getElementById("productForm");
const btnNew = document.getElementById("btnNew");
const btnCancel = document.getElementById("btnCancel");
const btnClose = document.getElementById("btnClose");

const confirmOverlay = document.getElementById("confirmOverlay");
const confirmMessage = document.getElementById("confirmMessage");
const btnConfirmClose = document.getElementById("btnConfirmClose");
const btnConfirmCancel = document.getElementById("btnConfirmCancel");
const btnConfirmAccept = document.getElementById("btnConfirmAccept");

const fieldId = document.getElementById("productId");
const fieldName = document.getElementById("name");
const fieldDescription = document.getElementById("description");
const fieldPrice = document.getElementById("price");
const fieldStock = document.getElementById("stock");
const fieldImageUrl = document.getElementById("imageUrl");

let searchTimeout = null;

document.addEventListener("DOMContentLoaded", () => loadProducts());

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadProducts(searchInput.value), 300);
});

[navHome, navProducts].forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        searchInput.value = "";
        loadProducts();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});

btnNew.addEventListener("click", () => openModal());
btnCancel.addEventListener("click", () => closeModal());
btnClose.addEventListener("click", () => closeModal());
modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
        closeModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }
    if (!confirmOverlay.hidden) {
        closeConfirm(false);
    } else if (!modalOverlay.hidden) {
        closeModal();
    }
});

productForm.addEventListener("submit", saveProduct);

async function loadProducts(search = "") {
    showMessage("Loading...");
    try {
        const url = search
            ? `${API_URL}?q=${encodeURIComponent(search)}`
            : API_URL;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }
        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error(error);
        grid.innerHTML = "";
        showMessage("Could not connect to the server. Make sure the backend is running at " + API_URL);
    }
}

function renderProducts(products) {
    grid.innerHTML = "";

    if (!products || products.length === 0) {
        showMessage("No products found.");
        return;
    }

    hideMessage();

    products.forEach((product) => {
        grid.appendChild(createCard(product));
    });
}

function createCard(product) {
    const card = document.createElement("article");
    card.className = "card";

    const image = document.createElement("img");
    image.className = "card__image";
    image.loading = "lazy";
    image.alt = product.name || "Product";
    image.src = product.imageUrl || "https://placehold.co/400x250?text=No+image";

    const body = document.createElement("div");
    body.className = "card__body";

    const name = document.createElement("h3");
    name.className = "card__name";
    name.textContent = product.name;

    const description = document.createElement("p");
    description.className = "card__description";
    description.textContent = product.description || "No description.";

    const meta = document.createElement("div");
    meta.className = "card__meta";
    meta.innerHTML = `
        <span class="card__price">${formatPrice(product.price)}</span>
        <span class="card__stock">Stock: ${product.stock}</span>
    `;

    const actions = document.createElement("div");
    actions.className = "card__actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => openModal(product));

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn--danger";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", () => deleteProduct(product.id, product.name));

    actions.append(btnEdit, btnDelete);
    body.append(name, description, meta, actions);
    card.append(image, body);

    return card;
}

function formatPrice(price) {
    const value = Number(price) || 0;
    return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function openModal(product = null) {
    productForm.reset();

    if (product) {
        modalTitle.textContent = "Edit product";
        fieldId.value = product.id;
        fieldName.value = product.name || "";
        fieldDescription.value = product.description || "";
        fieldPrice.value = product.price ?? "";
        fieldStock.value = product.stock ?? "";
        fieldImageUrl.value = product.imageUrl || "";
    } else {
        modalTitle.textContent = "New product";
        fieldId.value = "";
    }

    modalOverlay.hidden = false;
    fieldName.focus();
}

function closeModal() {
    modalOverlay.hidden = true;
    productForm.reset();
}

let confirmResolve = null;

function openConfirm(text) {
    confirmMessage.textContent = text;
    confirmOverlay.hidden = false;
    return new Promise((resolve) => {
        confirmResolve = resolve;
    });
}

function closeConfirm(result) {
    confirmOverlay.hidden = true;
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

btnConfirmAccept.addEventListener("click", () => closeConfirm(true));
btnConfirmCancel.addEventListener("click", () => closeConfirm(false));
btnConfirmClose.addEventListener("click", () => closeConfirm(false));
confirmOverlay.addEventListener("click", (event) => {
    if (event.target === confirmOverlay) {
        closeConfirm(false);
    }
});

async function saveProduct(event) {
    event.preventDefault();

    const id = fieldId.value;
    const payload = {
        name: fieldName.value.trim(),
        description: fieldDescription.value.trim(),
        price: Number(fieldPrice.value),
        stock: Number(fieldStock.value),
        imageUrl: fieldImageUrl.value.trim() || null,
    };

    try {
        const response = await fetch(id ? `${API_URL}/${id}` : API_URL, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }

        closeModal();
        loadProducts(searchInput.value);
    } catch (error) {
        console.error(error);
        alert("Could not save the product. Check the data and try again.");
    }
}

async function deleteProduct(id, name) {
    // Close the product form modal if it is open so the confirm dialog
    // doesn't render on top of it.
    closeModal();

    const confirmed = await openConfirm(`Delete "${name}"? This action cannot be undone.`);
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if (!response.ok && response.status !== 204) {
            throw new Error(`Error ${response.status}`);
        }
        loadProducts(searchInput.value);
    } catch (error) {
        console.error(error);
        alert("Could not delete the product.");
    }
}

function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
}

function hideMessage() {
    message.hidden = true;
}
