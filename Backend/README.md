# Backend Setup and Usage

This guide explains how to set up, configure, and run the backend server for the recipe application.

---

## Prerequisites

- **Node.js (v14 or later recommended)**
- **PostgreSQL** (installed and running)

---

## Installation

1. **Clone the repository:**

```bash
git clone <REPO_URL>
cd <REPO_FOLDER>
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment variables:**

Create a `.env` file in the root directory with the following structure:

```env
DATABASE_URL=postgresql://<your_username>:<your_password>@localhost:5432/recipe_db
JWT_SECRET=your_secure_random_secret
PORT=5000
```

- **Replace `<your_username>`** with your PostgreSQL username.
- **Replace `<your_password>`** with your PostgreSQL password.
- Keep `JWT_SECRET` a strong, unpredictable string.
- Adjust `PORT` if needed.

---

## Database

### Setup Instructions

1. **Access PostgreSQL CLI:**

```bash
psql -U postgres
```

2. **Create your database:**

```sql
CREATE DATABASE recipe_db;
```

3. **Connect to the database:**

```sql
\c recipe_db
```

4. **Create tables (run all together):**

```sql
-- Drop existing tables if any
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS users;

-- Create users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(150) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active', -- active, banned, etc.
  suspended_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create recipes with image_url
CREATE TABLE recipes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  instructions TEXT NOT NULL,
  image_url TEXT, -- new column for images
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ingredients
CREATE TABLE ingredients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- Create join table for recipes & ingredients
CREATE TABLE recipe_ingredients (
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES ingredients(id),
  quantity VARCHAR(50),
  PRIMARY KEY (recipe_id, ingredient_id)
);

-- Create favorites (many-to-many)
CREATE TABLE favorites (
  user_id INTEGER REFERENCES users(id),
  recipe_id INTEGER REFERENCES recipes(id),
  PRIMARY KEY (user_id, recipe_id)
);
```

---

## Run the Server

Start the backend server:

```bash
npm start
```

Default port is `5000`, accessible via:

```
http://localhost:5000
```

---

## API Usage Overview

### User Endpoints
- **POST /api/users/register** — Register a new user
- **POST /api/users/login** — Authenticate and get JWT token
- **PUT /api/users/:id** — Update user info
- **DELETE /api/users/:id** — Remove user

### Recipe Endpoints
- **POST /api/recipes** — Add a new recipe (requires auth)
- **GET /api/recipes/search** — Search recipes by ingredient or other filters
- **PUT /api/recipes/:id** — Update recipe
- **DELETE /api/recipes/:id** — Delete recipe (admin)

### Favorites Endpoints
- **POST /api/favorites/:recipeId** — Add recipe to favorites
- **DELETE /api/favorites/:recipeId** — Remove from favorites
- **GET /api/favorites** — List your favorite recipes

### Admin Endpoints
- **GET /api/admin/users** — List users (paginated)
- **DELETE /api/admin/users/:id** — Remove user
- **POST /api/admin/users/:id/ban** — Ban user
- **POST /api/admin/users/:id/suspend** — Suspend user
- **POST /api/admin/promote/:id** — Promote user to admin
- **GET /api/admin/logistics** — Stats: total users, recipes, etc.

---

## Security & Best Practices

- Helmet is enabled for security headers.
- Validation and centralized error handling are implemented.
- Rate limiting and other security headers can be customized further as needed.
- **Always keep your `JWT_SECRET` strong and private.**
