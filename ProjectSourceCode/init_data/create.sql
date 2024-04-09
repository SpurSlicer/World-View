CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    password CHAR(60) NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
    username_hash VARCHAR(50) NOT NULL,
    filename VARCHAR(50) NOT NULL,
    data TEXT
);
