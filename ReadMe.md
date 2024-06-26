# World-View

A user-centered platform where individuals can create web pages best suited to their interests. The trouble of creating and showing off your website to others will no longer be a hassle with World-View. World-View will host your website

Why is that you ask?
- You should use your time to create a website you want to show off instead of figuring out the dependencies to host one
- Find others who have the same interests as you
- Connect with other website creators to learn from one another

## Directory Structure
```
└── src/
    ├── images/
    │   └── *
    ├── init_data/
    │   └── create.sql
    ├── node_modules/
    │   └── *
    ├── test/
    │   └── server.spec.js
    ├── views/
    │   ├── files/
    │   │   ├── user_world_files/
    │   │   │   └── *
    │   │   └── world_files/
    │   │       └── *
    │   ├── layouts/
    │   │   └── main.hbs
    │   ├── pages/
    │   │   └── *
    │   └── partials/
    │       └── *
    ├── .env [NOTE: YOU must add this!!]
    ├── docker-compose.yaml
    ├── index.js
    ├── package.json
    └── package-lock.json
```
Images contains local resources for the webpage like the world icon; init_data builds the sql databases with `create.sql` when the `docker-compose.yaml` is run; node_modules contains npm libraries; test contains test case code should you want to run test cases; views contains a file cache for other user and current user world files, the main layout, webpages code, and partials used by webpages and main. YOU must create the .env file from the template below. `index.js` holds all custom API calls--all are in REST style. You should not need to edit the `docker-compose.yaml` or `package.json` files, though you may need to change the run command in `docker-compose.yaml` if you want to use test cases.

### src/.env
Format your .env file like so:
```
# database credentials
POSTGRES_USER="ENTER NAME"
POSTGRES_PASSWORD="ENTER PASSWORD"
POSTGRES_DB="ENTER DB NAME"

# Node vars
SESSION_SECRET="ENTER SECRET"
```
NEVER push this to github!!

## Built With
- [Docker](https://www.docker.com/products/docker-desktop/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Git](https://git-scm.com/downloads)/Github
- [VSCode](https://code.visualstudio.com/download)
- [NodeJS](https://nodejs.org/en/download)
- [Figma](https://www.figma.com/downloads/)
- Express
- bcrypt

## How to Run Locally
To clone and run this application, you'll need Docker installed on your computer.
```
# Clone
$ git clone git@github.com:SpurSlicer/World-View.git

# Go into repository
$ cd src

# Start docker
$ docker compose up
```
Finally go to this link: http://localhost:3000/

```
# Stop docker
$ docker compose down

# Stop docker and delete database content
$ docker compose down -v
```

## Link
World-View Web Version: http://worldview.eastus.cloudapp.azure.com:3000/
