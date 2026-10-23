# Catalog

Product catalog with a Spring Boot 3 (Java 21) and PostgreSQL REST backend. The plain HTML/CSS/JavaScript frontend includes product CRUD and a separate Rick and Morty browser, with responsive layouts and search.

## Structure

```text
catalog/
  backend/     REST API (Spring Boot + PostgreSQL)
  frontend/    Static pages (vanilla HTML/CSS/JS)
```

The backend follows the same layered organization and database connection scheme as the `store` project:

```text
src/main/java/com/catalog/
  CatalogApplication.java
  Controller/ProductController.java
  Model/Product.java
  Repository/ProductRepository.java
  Service/ProductService.java
  config/WebConfig.java          # CORS, since the frontend is a separate origin
```

## Backend

### Requirements

- JDK 21
- Maven 3.9+
- PostgreSQL

### Database

Create the database, a dedicated role, and grant it access (including the `public` schema — required since PostgreSQL 15, where `GRANT ALL PRIVILEGES ON DATABASE` alone no longer allows creating tables):

```sql
CREATE DATABASE catalog WITH ENCODING 'UTF8';
CREATE ROLE catalog WITH LOGIN PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE catalog TO catalog;
GRANT ALL ON SCHEMA public TO catalog;
```

### Configuration

Same as `store`: `application.properties` activates the `local` profile and reads credentials from variables (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`), defined in `src/main/resources/application-local.properties` (ignored by Git). It already exists with default values; adjust it to your environment:

```properties
DB_URL=jdbc:postgresql://localhost:5432/catalog
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

There is an example in `application-local.properties.example` in case you need to recreate it.

### Run

```bash
cd backend
mvn spring-boot:run
```

Or, from IntelliJ IDEA: open the `backend` folder (where `pom.xml` lives) so it's imported as a Maven project, then run `CatalogApplication` (the ▶️ next to its `main` method, or `Run > Run 'CatalogApplication'`).

The API is available at `http://localhost:8080/api/products`. `spring.jpa.hibernate.ddl-auto=update` creates or updates the `products` table on startup. Spring Boot then runs `src/main/resources/data.sql`, which seeds 15 English-language products when their names are missing. Existing products are preserved, including any changes made through the catalog.

### Endpoints

| Operation      | Method | Route                      |
|----------------|--------|-----------------------------|
| List / search  | GET    | `/api/products?q=text`      |
| Get one        | GET    | `/api/products/{id}`        |
| Create         | POST   | `/api/products`             |
| Update         | PUT    | `/api/products/{id}`        |
| Delete         | DELETE | `/api/products/{id}`        |

Expected JSON body for POST/PUT:

```json
{
  "name": "Mechanical keyboard",
  "description": "Red switches, backlit",
  "price": 59.99,
  "stock": 15,
  "imageUrl": "https://example.com/keyboard.jpg"
}
```

CORS is enabled for `/api/**` from any origin (intended for local development).

## Frontend

Static pages with no build step. The product catalog needs the backend running at `http://localhost:8080`; the Rick and Morty page calls its public API directly and needs internet access.

**From IntelliJ IDEA** (no terminal needed): open `frontend/index.html` or `frontend/rick-morty.html` in the editor and click the browser icon shown at the top right of the file (or right-click → "Open in Browser"). IntelliJ serves the pages through its built-in web server, avoiding `file://` restrictions.

**From a terminal**, serve it with a simple static server:

```bash
cd frontend
python3 -m http.server 5500
```

Then visit `http://localhost:5500`.

Includes:

- A search box at the top (filters by name against the backend).
- A responsive card grid: 3 columns on desktop, 2 on tablet, 1 on mobile (CSS Grid + media queries in `css/styles.css`).
- Create, edit, and delete products through a modal form.
- A Rick and Morty page at `rick-morty.html` with Characters, Locations, and Episodes tabs, API pagination, and name search debounced by four seconds. Character cards show an image and ID; select one to open its details.

If your API runs at a different URL, change the `API_URL` constant in `frontend/js/app.js`.
