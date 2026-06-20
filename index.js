
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

app.get("/favorites/check", async (req, res) => {
    try {
        const { email, propertyId } = req.query;

        if (!email || !propertyId) {
            return res.status(400).json({ isFavorite: false, message: "Missing query parameters" });
        }

        // ডাটাবেসে এই ইউজার এবং প্রোপার্টির কোনো রেকর্ড আছে কিনা চেক করা
        const favorite = await favoritesCollection.findOne({ 
            tenantEmail: email, 
            propertyId: propertyId 
        });

        if (favorite) {
            // যদি খুঁজে পাওয়া যায়
            return res.json({ isFavorite: true, favoriteId: favorite._id });
        } else {
            // যদি খুঁজে না পাওয়া যায়
            return res.json({ isFavorite: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ isFavorite: false, error: "Internal server error" });
    }
});

app.delete('/favorites', async (req, res) => {
    try {
        const { favItemId, tenantEmail } = req.query;
        const query = { 
            _id: new ObjectId(favItemId), 
            tenantEmail: tenantEmail
        };
       
    
        const removedDoc = await favoritesCollection.deleteOne(query);
        res.json(removedDoc);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: "Failed to remove from favorites" });
    }
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