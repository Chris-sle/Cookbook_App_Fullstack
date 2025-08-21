Backend Setup and Usage
This documentation provides instructions to set up, configure, and run the backend server for the recipe application.

Prerequisites
Node.js (v14 or later recommended)
PostgreSQL installed and running
Installation
Clone the repository:
bash

git clone <REPO_URL>
cd <REPO_FOLDER>
Install dependencies:
bash

npm install
Create and configure environment variables:
Create a .env file in the root directory with the following content:

env

DATABASE_URL=postgresql://<your_username>:<your_password>@localhost:5432/recipe_db
JWT_SECRET=your_secret_key
PORT=5000
Replace:

<your_username> with your PostgreSQL username
<your_password> with your PostgreSQL password
Adjust PORT if needed
Database
Setup the Database and Tables
Access PostgreSQL:
bash

psql -U postgres
Create the recipe_db database:
sql

CREATE DATABASE recipe_db;
Connect to the database:
sql

\c recipe_db
Create the necessary tables:
sql

-- Drop existing tables if any (optional)
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS users;

-- Create `users` table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(150) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create `recipes` table
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    ingredients TEXT NOT NULL,
    instructions TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create `favorites` table
CREATE TABLE favorites (
    user_id INTEGER REFERENCES users(id),
    recipe_id INTEGER REFERENCES recipes(id),
    PRIMARY KEY (user_id, recipe_id)
);
Running the Server
Start the backend server:

bash

npm start
Default port is 5000, accessible via:

text

http://localhost:5000
API Usage Overview
(Details to be expanded upon - include endpoints, request/response formats, authentication, etc.)

Register new users
Log in to receive authentication tokens
Add, retrieve, update, delete recipes
Manage favorites
Admin controls for recipe moderation
(Note: API endpoints and their specifications will be documented shortly.)