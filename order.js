const express = require('express');
const router = express.Router();



// MongoDB client
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://minooeip:minooei89@cluster0.c7gpila.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";;

const client = new MongoClient(uri);

// Remove Extension
function removeExtension(filename) {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
}



router.get('/order', async (req, res) => {
  const selectedFilename = req.query.filename;
  // Connect to the MongoDB client
  await client.connect();
  const db = client.db('web322');
  const image = await db.collection('Gallery').findOne({ FILENAME: req.query.filename });
  if (image) { 
    image.filenameWithoutExtension = removeExtension(image.FILENAME);
  }

  if (!image) {
    console.error("Image not found for filename:", req.query.filename); 
  }
  res.render('order', { image: image });
});

router.post('/order', async (req, res) => {
  await client.connect();
  const db = client.db('web322');
  if (req.body.action === 'BUY') {
    await db.collection('Gallery').updateOne({ FILENAME: req.body.filename }, { $set: { STATUS: 'S' } });
  }
  res.redirect('/gallery');
});

router.post('/order/buy', async (req, res) => {
  const filename = req.body.filename;
  await client.connect();
  const db = client.db('web322');
  try {
      const collection = db.collection('Gallery'); 

      const result = await collection.updateOne({ FILENAME: filename }, { $set: { STATUS: 'S' } });
      if (result.modifiedCount === 1) {
          res.redirect('/main');  
      } else {
          res.status(404).send('Image not found'); 
      }
  } catch (error) {
      console.error("Error updating image status:", error);
      res.sendStatus(500); 
  }
});

module.exports = router;
