// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************
//import { fstat } from "fs";
//import all from "googleapi.js"

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const fs = require('fs'); // File system operations

const dir = path.join("views", "world_files");
const options = {
  root: path.join(__dirname, 'views', 'world_files')
};
const sampleHTML = 
  `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
  </head>
  <body>
    
  </body>
  </html>`;

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.
app.use(express.static(path.join(__dirname, 'views', 'world_files')));



// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);



// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

function deleteFiles() {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, {recursive:true});
  }
  fs.mkdirSync(dir, {recursive:true});
}

// TODO - Include your API routes here
app.get('/', (req, res) => {
    res.status(200);
    res.redirect('/users');
});

app.get('/register', (req, res) => {
  res.status(200);
  res.render('pages/register')
});

app.post('/register', async (req, res) => {
    //hash the password using bcrypt library
    const hash = await bcrypt.hash(req.body.password, 10);
    // To-DO: Insert username and hashed password into the 'users' table
    const query = "INSERT INTO users (username, password) VALUES ($1, $2);"
    await db.none(query, [req.body.username, hash])
    .then(() => {
      res.status(200);
      res.redirect('/login');
    })
    .catch(err => {
      //console.log(err);
      res.status(400);
      res.render('pages/register', { message: "Username already exists!." });
    });
});

app.get('/login', (req, res) => {
    res.status(200);
    res.render('pages/login')
});

app.post('/login', async (req, res) => {
    try {
        const query = "SELECT * FROM users WHERE username = $1;";
        const usernameHash = await bcrypt.hash(req.body.username, 10);
        const queryFiles = "SELECT * FROM files WHERE username_hash = $1;";
        console.log("made it here");
        await db.one(query, [req.body.username])
          .then(async (user) => {
            console.log(`made it here 2 ${user}`);
            const matching = await bcrypt.compare(req.body.password, user.password);
            console.log(`matching is: ${matching} for ${user.username}, ${user.password} compared to ${req.body.username}, ${req.body.password}`);
            if (!matching) {
              console.log("No matching found");
              res.status(400);
              return res.render('pages/login', { message: "Incorrect password." });
            } else {
              console.log("Match found. Continuing...");
              req.session.user = user;
              req.session.save();
              deleteFiles();
              const files = await db.one(queryFiles, [usernameHash])
                .then(() => {
                  for (const file of files) {
                    fs.writeFile(path.join(dir, file.filename), file.data, err => {
                      if (err) {
                        console.log(`$${file.filename} could not be written to ${dir}!`);
                      } else {
                        console.log(`$${file.filename} was written to ${dir}!`);
                      }
                    });
                  }
                })
                .catch((err) => {
                  fs.writeFile(path.join(dir, 'index.html'), sampleHTML, err => {
                    if (err) {
                      console.log(`index.html could not be written to ${dir}!`);
                    } else {
                      console.log(`index.html was written to ${dir}!`);
                    }
                  });
                });
              res.status(200);
              res.redirect('/myworld');
            }
          })
          .catch(err => {
            console.log(`No users found of ${err}!`);
            res.status(400);
            return res.render('pages/login', { message: "Incorrect username." });  
          });
    } catch (err) {
        //console.log(err);
        res.render('pages/login', { message: "A server error occurred." });
    }
});

app.post('/save', async (req, res) => {
    try {
      const queryDel = 'DELETE FROM files WHERE username_hash = $1;';
      const queryIns = 'INSERT INTO files (username_hash, filename, data) VALUES ($1, $2, $3);';
      const usernameHash = await bcrypt.hash(req.session.user.username, 10);
      await db.one(queryDel, [usernameHash])
        .then(() => {
          const worldDir = fs.opendir(dir, err => {
            if (err) {
              console.log(`${dir} could not be opened!`);
            } else {
              console.log(`${dir} was opened!`);
            }
            for  (const dirent of worldDir) {
              if (dirent.isFile()) {
                fs.readFile(path.join(dir, dirent.name), async (err, data) => {
                  if (err) {
                    console.log(`${dirent.name} caused an error!`);
                  } else {
                    console.log(data);
                    await db.one(queryIns, [usernameHash, (dir + dirent.name), data]);  
                    console.log(`${dirent.name} was saved!`);
                  }
                });
              } else {
                console.log(`${dir + dirent.name} is not a file`);
              }
            }
            dir.close();
        })
        .catch((err) => {
          console.log("No files were deleted I guess");
          res.status(400);
        })
      });
    } catch (err) {
        //console.log(err);
        res.render('pages/login', { message: "A server error occurred." });
    }
});

// Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to login page.
      return res.redirect('/login');
    }
    next();
};
  
app.get('/welcome', (req, res) => {
  res.status(200);
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/logout', (req, res) => {
  console.log(`dir is ${dir}`);
  deleteFiles();
  req.session.destroy();
  res.status(200);
  res.render('pages/logout', { message: "Logged out successfully" })
});

// Authentication Required
app.use(auth);

app.get('/view', (req, res) => {
    res.status(200);
    res.sendFile('index.html', options, (err) => {
      if (err) {
        console.log('Error sending file:', err);
      } else {
        console.log('Sent successfully');
      }
    });
});

app.get('/myworld', (req, res) => {
    if (!req.session.user) {
      res.status(400);
      return res.redirect('/login');
    }
    const file_contents = fs.readFileSync(path.join(dir, 'index.html'));
    console.log(file_contents);
    res.status(200);
    res.render("pages/myworld");
});

// Direct Messages

app.get('/users', (req, res) => {
    const currentUser = req.session.user.username; // Ensure your session is correctly configured to get this

    db.any('SELECT username FROM users WHERE username != $1', [currentUser])
        .then(users => {
            res.render('pages/users', { users });
        })
        .catch(error => {
            console.log('ERROR:', error);
            res.send('Error fetching users');
        });
});


app.get('/messages/:username', (req, res) => {
    const messagesFrom = req.params.username;
    const currentUser = req.session.user.username

    db.any(`
        SELECT m.*, u.username AS sender_username
        FROM messages m
        JOIN users u ON m.sender_id = u.username
        WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY timestamp ASC`, [currentUser, messagesFrom])
        .then(messages => {
            res.render('pages/messages', { messages, receiver: messagesFrom });
        })
        .catch(error => {
            console.log('ERROR:', error);
            res.send('Error fetching messages');
        });
});



app.post('/messages/:username', (req, res) => {
    const sendingTo = req.params.username;
    const currentUser = req.session.user.username
    const message = req.body.message;

    db.none('INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)', [currentUser, sendingTo, message])
        .then(() => {
            res.redirect('/messages/' + sendingTo);
        })
        .catch(error => {
            console.log('ERROR:', error);
            res.send('Error sending message');
        });
});




// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

// This needs to replace app.listen(3000);
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');