// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************
//import { fstat } from "fs";
//import all from "googleapi.js"

const express = require('express'); // To build an application server or API
const app = express();
const fileUpload = require('express-fileupload');
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const fs = require('fs'); // File system operations
const url = require('url');
const { isUndefined } = require('util');

const dir = path.join("views", "files", "world_files");
const userDir = path.join("views", "files", "user_world_files");
const options = {
  root: path.join(__dirname, 'views', 'files')
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

Handlebars.registerHelper("ifeq", function (a, b, options) {
    if (a == b) { return options.fn(this); }
    return options.inverse(this);
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
app.use(express.static(path.join(__dirname, 'views', 'files')));
app.use(fileUpload({
  limits: { fileSize: 1024**3}
}));
app.use(bodyParser.json({limit: "500mb"}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: "500mb",
  parameterLimit: 50000
}));
app.use(express.json({ limit: "500mb" }));
//app.use(express.limit("500mb"));
app.use(express.urlencoded({ 
  extended: true, 
  limit: "500mb ",
  parameterLimit: 50000
}));


// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);



// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

function deleteFiles(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, {recursive:true});
  }
  fs.mkdirSync(dir, {recursive:true});
}

function sessionPush(r, s, m) {
  console.log(`Pushing:`, m);
  r.push(m);
  s.save();
  return;
}

function sessionPop(r, s) {
  if (r.length > 0) {
    const m = r.pop();
    s.save();
    return m;
  } else return ``;
}

// TODO - Include your API routes here
app.get('/', async (req, res) => {
  try {
    
    const query = 'SELECT users.username, files.filename FROM users LEFT JOIN files on files.username_hash = users.username;';
    const data = await db.any(query);

    res.render('pages/home', { title: 'Welcome to World View!', nodes: data, username: (req.session.user) ? req.session.user.username : `` });

  }
  catch (err){
    res.render('pages/home', { message: "Error!! home", username: (req.session.user) ? req.session.user.username : ``});
  }});

app.get('/register', (req, res) => {
  res.status(200);
  res.render('pages/register');
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
    res.render('pages/login');
});

app.post('/login', async (req, res) => {
    try {
        const query = "SELECT * FROM users WHERE username = $1;";
        const queryFiles = "SELECT * FROM files WHERE username = $1;";
        console.log("made it here");
        await db.one(query, [req.body.username])
          .then(async (user) => {
            const matching = await bcrypt.compare(req.body.password, user.password);
            console.log(`matching is: ${matching} for ${user.username}, ${user.password} compared to ${req.body.username}, ${req.body.password}`);
            if (!matching) {
              console.log("No matching found");
              res.status(400);
              return res.render('pages/login', { message: "Incorrect password."});
            } else {
              console.log("Match found. Continuing...");
              req.session.user = user;
              req.session.url = `index.html`;
              req.session.messages = [];
              req.session.save();
              deleteFiles(dir);
              await db.any(queryFiles, [req.body.username])
                .then((files) => {
                  if (files.length > 0) {
                    console.log(`FILES FOUND:`, files, files.length);
                    for (const file of files) {
                      fs.writeFile(path.join(dir, file.filename), file.data, err => {
                        if (err) {
                          console.log(`$${file.filename} could not be written to ${dir}!`);
                        } else {
                          console.log(`$${file.filename} was written to ${dir}!`);
                        }
                      });
                    }
                  } else {
                    console.log(`NO FILES FOUND!`);
                    fs.writeFile(path.join(dir, 'index.html'), sampleHTML, err => {
                      if (err) {
                        console.log(`index.html could not be written to ${dir}!`);
                      } else {
                        console.log(`index.html was written to ${dir}!`);
                      }
                    });
                  }
                })
                .catch((err) => {
                  console.log(`Unexpected db error ${err}!`);
                  res.status(400);
                  return res.render('pages/login', { message: "Unexpected db error."});        
                });
              res.status(200);
              res.redirect('/myworld');
            }
          })
          .catch(err => {
            console.log(`No users found of ${err}!`);
            res.status(400);
            return res.render('pages/login', { message: "Incorrect username."});  
          });
    } catch (err) {
        //console.log(err);
        res.render('pages/login', { message: "A server error occurred."});
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
  deleteFiles(dir);
  deleteFiles(userDir);
  req.session.destroy();
  res.status(200);
  res.render('pages/logout', { message: "Logged out successfully" })
});

app.get('/test', async (req, res) => {
  const query1 = `SELECT * FROM users`;
  const query2 = `SELECT * FROM files`;
  console.log(`URL:`, req.session.url);
  console.log(`MESSAGES:`, req.session.messages);
  await db.any(query1)
    .then((users) => {
      console.log("USERS");
      console.log(users);
    })
    .catch((err) => {
      console.log(err);
    });
  await db.any(query2)
    .then((files) => {
      console.log("FILES");
      console.log(files);
    })
    .catch((err) => {
      console.log(err);
    });
  res.redirect('/myworld');
});

app.get('/home', async (req, res) => {
  try {
    
    const query = 'SELECT users.username, files.filename FROM users LEFT JOIN files on files.username_hash = users.username;';
    const data = await db.any(query);

    res.render('pages/home', { title: 'Welcome to World View!', nodes: data, username: (req.session.user) ? req.session.user.username : `` });

  }
  catch (err){
    res.render('pages/home', { message: "Error!! home", username: (req.session.user) ? req.session.user.username : ``});
  }
});

app.post('/submitusername', (req, res) => {
  res.status(200);
  const str = encodeURIComponent(req.body.username);
  res.redirect("/view?u=" + str);
});

app.get('/viewuserworld', (req, res) => {
  res.status(200);
  res.sendFile(path.join('user_world_files', 'index.html'), options, (err) => {
    if (err) {
      console.log('Error sending file:', err);
    } else {
      console.log('Sent successfully');
    }
  });
});

app.get('/view', async (req, res) => {
  if (req.query.u) {
    const username = req.query.u;
    console.log(username);
    if (username === ``) {
      res.status(400);
      return res.render('pages/login', {message: `username sent incorrectly!`, username: (req.session.user) ? req.session.user.username : `` });    
    }
    const queryFiles = "SELECT * FROM files WHERE username_hash = $1;";
    deleteFiles(userDir);
    await db.any(queryFiles, [username])
      .then((files) => {
        if (files.length > 0) {
          console.log(`USER FILES FOUND:`, files, files.length);
          for (const file of files) {
            fs.writeFile(path.join(userDir, file.filename), file.data, err => {
              if (err) {
                console.log(`$${file.filename} could not be written to ${dir}!`);
              } else {
                console.log(`$${file.filename} was written to ${dir}!`);
              }
            });
          }
          res.status(200);
          res.render('pages/login', {title: `${username}'s World`, src: `/viewuserworld`, username: username});
        } else {
          res.status(404);
          return res.render('pages/home', {message: `${username} has no world files!`, username: (req.session.user) ? req.session.user.username : `` });    
        }
      })
      .catch((err) => {
        console.log(`Unexpected db error ${err}!`);
        res.status(400);
        return res.render('pages/login', { message: "Unexpected db error."});        
      });
  } else {
    res.status(200);
    res.render("pages/view", {title: `${req.session.user.username}'s World`, src: `/viewmyworld`, username: req.session.user.username});
  }
});

// Authentication Required
app.use(auth);

// Maybe use an iframe for this 👀👀
app.get('/viewmyworld', (req, res) => {
  res.status(200);
  res.sendFile(path.join('world_files', 'index.html'), options, (err) => {
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
    const worldDir = fs.readdirSync(dir, err => {
      if (err) {
        console.log(`${dir} could not be opened!`);
      } else {
        console.log(`${dir} was read from!`);
      }
    });
    let flag = false;
    for (const dirent of worldDir) {
      if (dirent == `index.html`) {
        flag = true;
        break;
      }
    }
    if (worldDir.length === 0 || !flag) {
      console.log(`Making template...`);
      fs.writeFileSync(path.join(dir, 'index.html'), sampleHTML, err => {
        if (err) {
          console.log(`index.html could not be written to ${dir}!`);
        } else {
          console.log(`index.html was written to ${dir}!`);
        }
      });
      req.session.url = `index.html`;
    }
    if (!fs.existsSync(path.join(dir, req.session.url))) req.session.url = `index.html`;
    const fileContents = fs.readFileSync(path.join(dir, req.session.url));
    const m = sessionPop(req.session.messages, req.session);
    res.status(200);
    res.render("pages/myworld", { file: fileContents.toString(), filenames: worldDir, curr: req.session.url, username: req.session.user.username, message: (m) ? m : ``});
});

app.post('/savefile', async (req, res) => {
  try {
    const queryInsert = `INSERT INTO files (username, filename, data)
                        VALUES ($1, $2, $3);`;
    const queryUpdate = `UPDATE files SET data = $3 WHERE username = $1 AND filename = $2 RETURNING username;`;
    const queryDelete = `DELETE FROM files WHERE username = $1 AND filename = $2;`;
    console.log(`OG FILENAME:`, req.session.url);
    console.log(`NEW FILENAME:`, req.body.filename);
    if (req.session.url != req.body.filename) {
      fs.renameSync(path.join(dir, req.session.url), path.join(dir, req.body.filename));
      await db.none(queryDelete, [req.session.user.username, req.session.url])
        .then(() => {
          console.log(`${req.body.filename} deleted... ready for replacement`);
        })
        .catch((err) => {
          console.log(err);
        });
      req.session.url = req.body.filename;
      req.session.save();
    } else console.log(`no filename change detected`);
    //maybe add in wait for promise to be fulfilled or not
    await db.one(queryUpdate, [req.session.user.username, req.body.filename, req.body.file])
      .then((r) => {
        console.log(`SAVE: ATTEMPTING UPDATE`)
        fs.writeFileSync(path.join(dir, req.body.filename), req.body.file, (err) => {
          if (err) console.log(`could not write ${req.body.filename}`);
          else console.log(`wrote ${req.body.filename} successfully`);
        });
        sessionPush(req.session.messages, req.session, `${req.body.filename} saved successfully!`);
        res.status(200);
        res.redirect("/myworld");
      })
      .catch(async (err) => {
        //console.log(err);
        console.log("SAVE: ATTEMPTING INSERT");
        await db.none(queryInsert, [req.session.user.username, req.body.filename, req.body.file])
          .then(() => {
            fs.writeFileSync(path.join(dir, req.body.filename), req.body.file, (err) => {
              if (err) console.log(`could not write ${req.filename}`);
              else console.log(`wrote ${req.body.filename} successfully`);
            });
            sessionPush(req.session.messages, req.session, `${req.body.filename} saved successfully!`);
            res.status(200);
            res.redirect("/myworld");
          })
          .catch((err) => {
            console.log(err);
            console.log("in error block :(");
            sessionPush(req.session.messages, req.session, `error in saving ${req.body.filename}!`);
            res.status(400);
            res.redirect("/myworld");    
          });
      });
  } catch (err) {
      console.log(err);
      sessionPush(req.session.messages, req.session, `A server error occurred.`);
      res.redirect('/myworld');
  }
});

app.post('/deletefile', async (req, res) => {
  try {
    const query = `DELETE FROM files WHERE username = $1 AND filename = $2;`;
    await db.none(query, [req.session.user.username, req.body.filename])
      .then(() => {
        console.log(`Deleting file`, req.body.filename);
        fs.rmSync(path.join(dir, req.body.filename));
        req.session.url = `index.html`;
        req.session.save();
        sessionPush(req.session.messages, req.session, `${req.body.filename} Deleted from database!`);
        res.status(200);
        res.redirect('/myworld');
      })
      .catch((err) => {
        console.log(err);
        sessionPush(req.session.messages, req.session, `Could not delete ${req.body.filename}; is it saved?!`);
        res.status(400);
        res.redirect('/myworld');
      });
  } catch (err) {
    console.log(err);
    sessionPush(req.session.messages, req.session, `A server error occurred.`);
    res.redirect('/myworld');  }
});

app.post('/openfile', async (req, res) => {
  try {
    console.log(`opening file`, req.body.filename);
    req.session.url = req.body.filename;
    req.session.save();
    res.redirect("/myworld");
  } catch (err) {
    console.log(err);
    sessionPush(req.session.messages, req.session, `A server error occurred.`);
    res.redirect('/myworld');  }
})

app.post('/uploadfile', async (req, res) => {
  try {
    if (req.files.file.length > 1) {
      for (const file of req.files.file) {
        console.log(`UPLOADING FILE`, file.name);
        fs.writeFileSync(path.join(dir, file.name), file.data, (err) => {
          if (err) console.log(`could not upload ${file.name}`);
          else console.log(`uploaded ${file.name} successfully`);
        });
      }
    } else {
      const file = req.files.file;
      console.log(`UPLOADING FILE`, file.name);
      fs.writeFileSync(path.join(dir, file.name), file.data, (err) => {
        if (err) console.log(`could not upload ${file.name}`);
        else console.log(`uploaded ${file.name} successfully`);
      });
    }
    sessionPush(req.session.messages, req.session, `File upload completed successfully!`);
    res.status(200);
    res.redirect('/myworld');
  } catch (err) {
    console.log(err);
    sessionPush(req.session.messages, req.session, `A server error occurred.`);
    res.redirect('/myworld');  }
})

app.post('/newfile', async (req, res) => {
  try {
    let count = 1;
    while (fs.existsSync(path.join(dir, `newfile${count}`))) count++;
    fs.writeFileSync(path.join(dir, `newfile${count}`), ``, err => {
      if (err) {
        console.log(`new file could not be written to ${dir}!`);
      } else {
        console.log(`new file was written to ${dir}!`);
      }
    });
    req.session.url = `newfile${count}`;
    req.session.save();
    res.redirect('/myworld');
  } catch (err) {
    console.log(err);
    sessionPush(req.session.messages, req.session, `A server error occurred.`);
    res.redirect('/myworld');  }
});

// Direct Messages

app.get('/users', (req, res) => {
    const currentUser = req.session.user.username; // Ensure your session is correctly configured to get this

    db.any('SELECT username FROM users WHERE username != $1', [currentUser])
        .then(users => {
            res.render('pages/users', { users, username: req.session.user.username });
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
            res.render('pages/messages', { messages, receiver: messagesFrom, username: req.session.user.username});
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

// Friends

// Route to display friends
app.get('/friends', async (req, res) => {
  const user = req.session.user.username;
  const friends = await db.any('SELECT friend_id FROM friends WHERE user_id = $1', [user]);
  res.render('pages/friends', { friends });
});

// Route to add a friend
app.post('/addfriend', async (req, res) => {
  const user = req.session.user.username;
  const { friend } = req.body;
  const friends = await db.any('SELECT friend_id FROM friends WHERE user_id = $1', [user]);
  const friendExists = await db.oneOrNone('SELECT username FROM users WHERE username = $1', [friend]);
  const alreadyFriends = await db.oneOrNone('SELECT user_id FROM friends WHERE (user_id = $1 AND friend_id = $2)', [user, friend])

  if (user === friend) {
    res.render('pages/friends', { message: "Cannot add yourself as a friend", friends });
  } else if (!friendExists) {
    res.render('pages/friends', { message: "This user does not exist", friends });
  } else if (alreadyFriends) {
    res.render('pages/friends', { message: "You are already friends with this person", friends });
  } else {
    await db.none('INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)', [user, friend]);
    res.redirect('/friends');
  }
}); 

// Route to unfriend someone
app.post('/unfriend', async (req, res) => {
  const user = req.session.user.username;
  const { friend } = req.body;
  await db.none('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [user, friend]);
  res.redirect('/friends');
});





// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

// This needs to replace app.listen(3000);
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');