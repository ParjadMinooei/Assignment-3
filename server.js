const express = require('express');
const exphbs = require('express-handlebars');
const fs = require('fs');
const sessions = require('client-sessions');
const readline = require("linebyline");
const path = require("path");
const app = express();
const randomstring = require('randomstring');
const port = 3000;
const rl = readline("./images.txt");
const orderRouter = require('./order.js');
const { ObjectId } = require('mongodb');

// Partial handlebar
const hbs = exphbs.create({});
hbs.handlebars.registerPartial('head', fs.readFileSync('./views/partials/head.hbs', 'utf8'));


// RemoveExt Handlebar Helper
var Handlebars = require('handlebars');
Handlebars.registerHelper('removeExt', function(filename) {
    return filename.replace(/\.[^/.]+$/, "");
});


async function validateFilename(filename) {
  const db = client.db("web322");
  const collection = db.collection("Gallery"); 

  const imageExists = await collection.findOne({ 
      FILENAME: { $regex: new RegExp('^' + filename + '$', 'i') } 
  });

  return imageExists ? filename : "Waterfall.webp"; 
}

// Register the helper
exphbs.create().handlebars.registerHelper('removeExt', function(filename) {
  return filename.replace(/\.[^/.]+$/, "");
});

// MongoDB client
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://minooeip:minooei89@cluster0.c7gpila.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
// Connect to MongoDB on server start
client.connect()
   .then(async () => {
         console.log("Connected to MongoDB");

         const db = client.db("web322");
         const collection = db.collection("Gallery");

         const imageData = await collection.find({}, { projection: { _id: 0, FILENAME: 1 } }).toArray();
         const finalarr = imageData.map(doc => doc.FILENAME); 
   })
   .catch(err => console.error("Error connecting to MongoDB:", err)); 

function removeExtension(filename) {
  const lastDotIndex = filename.lastIndexOf("."); 
  if (lastDotIndex !== -1) { 
    return filename.substring(0, lastDotIndex); 
  } else {
    return filename; 
  }
}

app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    defaultLayout: false,
    layoutsDir: path.join(__dirname, "./views")
}));
app.set('view engine', '.hbs');

app.use(sessions({
    secret: "Secret",
    cookieName: 'session',
    duration: 24 * 60 * 60 * 1000,
    activeDuration: 1 * 60 * 1000,
    httpOnly: true,
    secure: true,
    ephemeral: true
}));

let users = JSON.parse(fs.readFileSync('user.json', 'utf8'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(orderRouter);


app.get('/', (req, res) => {
    res.render('login');
});

app.post('/', (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }

  if (!users[username]) {
    return res.render('login', { error: 'Not a registered username' });
  } else {
    if (password !== users[username]) {
      return res.render('login', { error: 'Invalid password' });
    } else {
      req.session.username = username;
      res.redirect('/main');
    }
  }
});

app.get('/gallery', async (req, res) => {
  if (!req.session.username) {
      res.redirect('/');
  } else {
      try {
          const db = client.db("web322");
          const collection = db.collection("Gallery");
          const imageData = await collection.find({ STATUS: 'A' }).toArray(); 
          imageData.forEach(image => {
            image.filename = removeExtension(image.FILENAME); 
            image.originalFilename = image.FILENAME;  
          });
          res.render('viewData', { 
              username: req.session.username,
              imageList: imageData 
          }); 

      } catch (error) {
          console.error("Error getting images:", error);
          res.status(500).render('error', { error: error.message });
      }
  }
});

app.get('/logout', (req, res) => {
  req.session.reset();
  res.redirect('/');
});

var textByLine = [];
let numArray;
var finalarr = [];
var originalFilenames = []; 

rl.on("line", (line, lineCount, byteCount) => {
    originalFilenames.push(line.trim()); 
})
.on("error", (err) => {
    console.error(err);
})
.on("close", () => { 
});


app.use(express.static('public'));

app.get('/main', async (req, res) => {
  if (!req.session.username) {
      return res.redirect('/'); 
  }

  try {
    const db = client.db("web322");
    const collection = db.collection("Gallery");

    const imageData = await collection.find({ STATUS: 'A' }).toArray(); 
    
    // Select initial image
    const defaultFilename = "Waterfall.webp"; 
    const defaultImage = await collection.findOne({ FILENAME: defaultFilename });

    if (defaultImage) {
        defaultImage.imagePath = "./images/" + defaultImage.FILENAME;
    }

   res.render('viewData', { 
        username: req.session.username,
        imageList: imageData, 
        data1: defaultImage || { imagePath: "./images/Waterfall.webp" } 
    });

} catch (error) {
      console.error("Error getting image data:", error);
      res.status(500).render('error', { error: error.message }); 
  }
});




  

app.get('/order', async (req, res) => {
  let selectedImage = null;

    if (req.query.filename) { 
        selectedImage = await db.collection('Gallery').findOne({ FILENAME: req.query.filename }); 
    }

  if (selectedImage) {
    selectedImage.imagePath = "/images/" + selectedImage.FILENAME;
  }

  res.render('order', { image: selectedImage }); 
});



app.post('/order', async (req, res) => {

  try {
      if (!req.body.filename) {
          throw new Error('Missing image filename');
      } 
      const selectedImage = await db.collection('Gallery').findOne({ FILENAME: req.body.filename }); 

      if (!selectedImage) {
          throw new Error('Image not found'); 
      }
      if (req.body.action === 'BUY') {
          await db.collection('Gallery').updateOne({ _id: selectedImage._id },{ $set: { STATUS: 'S' } });
          res.redirect('/order-success'); 

      } else { 
         res.redirect('/main'); 
      }

  } catch (error) {
      console.error("Error processing purchase:", error);
      res.status(500).send("Error processing purchase");  
  }
});



app.post("/main", express.urlencoded({ extended: true }), async (req, res) => {
  const selectedFilename = req.body.images?.trim() || "Waterfall.webp"; 
  const filename = await validateFilename(selectedFilename);
  try {
      const db = client.db("web322");
      const collection = db.collection("Gallery");

      const imageData = await collection.find({ STATUS: 'A' }).toArray();
      const selectedImage = await collection.findOne({ FILENAME: filename });

      if (selectedImage) {
          selectedImage.imagePath = "./images/" + selectedImage.FILENAME; 
          selectedImage.filename = removeExtension(selectedImage.FILENAME);
      }
      res.render('viewData', { 
        username: req.session.username,
        imageList: imageData,
        data1: selectedImage || { imagePath: "./images/Waterfall.webp" } 
      });

  } catch (error) {
      console.error("Error handling form submission:", error);
      res.status(500).render('error', { error: error.message });
  }
});






app.use(function(req, res, next) {
  res.status(404).send("Sorry, couldn't find that!");
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

process.on('SIGINT', () => {
  client.close()
      .then(() => console.log("MongoDB connection closed"))
      .catch(err => console.error("Error closing MongoDB:", err))
      .finally(() => process.exit());
});


