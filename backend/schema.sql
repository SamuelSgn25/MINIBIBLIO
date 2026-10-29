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
