
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require('express');
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config(); 

const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8000;


app.get('/', (req, res) => {
  res.send('Hello World!')
})


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();
    const database = client.db("StayNest");
    const propertiesCollection = database.collection("properties");
    const reviewsCollection = database.collection("reviews");
    const bookingsCollection = database.collection("bookings");
    const favoritesCollection = database.collection("favorites");
   
   app.get('/properties', async (req, res) => {
    try {
        const properties = await propertiesCollection.find({}).toArray();
        res.json(properties)
    } catch (error) {
        console.error("Error fetching properties:", error);
       
    }
});

app.get('/properties/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await propertiesCollection.findOne(query);
    
    if (!result) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.get('/featuredProperties', async (req, res) => {
    
        const cursor = propertiesCollection.find({}).limit(6)
        const result =  await cursor.toArray()
        res.json(result)
       
    });

  app.post('/reviews', (req, res)=>{
    const newReview = req.body;
    const result = reviewsCollection.insertOne(newReview)
    res.json(result)
  })

   app.post('/favorites', (req, res)=>{
    const favorites = req.body;
    const result = favoritesCollection.insertOne(favorites)
    res.json(result)
  })

  app.get('/favorites', async (req, res) => {
        const cursor = favoritesCollection.find({})
        const result =  await cursor.toArray()
        res.json(result)
       
    });

    app.post('/bookings', (req, res)=>{
    const bookingData = req.body;
    const result = bookingsCollection.insertOne(bookingData)
    res.json(result)
  })


    app.get('/bookings', async (req, res) => {
        const cursor = bookingsCollection.find({})
        const result =  await cursor.toArray()
        res.json(result)
       
    });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})