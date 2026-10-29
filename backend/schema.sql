-- Connexion à la base de données PostgreSQL
-- \c minilib

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS books (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   title varchar(255) NOT NULL,
   autors_name varchar(255) NOT NULL,
   ISBN unique NOT NULL INTEGER,
   total_numbers_of_examplary INTEGER,
   status VARCHAR(50) DEFAULT 'rendu', -- 'rendu', 'emprunt', 'present'
   date_of_emprunt TIMESTAMP,
   date_of_return TIMESTAMP,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   name varchar(255) NOT NULL,
   email varchar(255) NOT NULL UNIQUE,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emprunts (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   book_id UUID REFERENCES books(id) ON DELETE CASCADE,
   member_id UUID REFERENCES members(id) ON DELETE CASCADE,
   date_of_emprunt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   date_of_return TIMESTAMP,
   status VARCHAR(50) DEFAULT 'emprunt' -- 'emprunt', 'rendu'
);

CREATE TABLE IF NOT EXISTS users (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   username varchar(255) NOT NULL UNIQUE,
   email varchar(255) NOT NULL UNIQUE,
   password varchar(255) NOT NULL,
   role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin'
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);