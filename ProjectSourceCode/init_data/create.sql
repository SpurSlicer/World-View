CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    password CHAR(60) NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
    username_hash VARCHAR(50) NOT NULL,
    filename VARCHAR(50) NOT NULL,
    data TEXT
);

CREATE TABLE IF NOT EXISTS friends (
    friend_id SERIAL PRIMARY KEY,
    user_username_1 VARCHAR(50) NOT NULL,
    /*ensure usernames exist in table*/
    CONSTRAINT fk_user_username_1 FOREIGN KEY (user_username_1) REFERENCES users(username),
    CONSTRAINT fk_user_username_2 FOREIGN KEY (user_username_2) REFERENCES users(username),
    /*so user cannot friend themseves */
    CONSTRAINT check_user_username CHECK (user_username_1 <> user_username_2)
);
