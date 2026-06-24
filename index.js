
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

    // await client.connect();
    const database = client.db("StayNest");
    const propertiesCollection = database.collection("properties");
    const reviewsCollection = database.collection("reviews");
    const bookingsCollection = database.collection("bookings");
    const transactionsCollection = database.collection("transactions");
    const favoritesCollection = database.collection("favorites");
    const userCollection = database.collection("user");


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
      const result = await cursor.toArray()
      res.json(result)

    });


    app.post('/properties/owner', async (req, res) => {
      try {
        const propertyData = req.body;


        const result = await propertiesCollection.insertOne(propertyData);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add property", error: error.message });
      }
    });

    app.get('/properties/owner/:email', async (req, res) => {
      try {
        const ownerEmail = req.params.email;

        const query = { "ownerInformation.email": ownerEmail };

        const result = await propertiesCollection.find(query).toArray();

        if (!result || result.length === 0) {
          return res.status(404).json({ message: "No properties found for this owner." });
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
      }
    });


    app.patch('/properties/admin', async (req, res) => {
      try {
        const { newStatus, feedback = '' } = req.query;
        const { id } = req.body;

        if (!id) {
          return res.status(400).json({ error: "Property ID is required" });
        }

        const filter = { _id: new ObjectId(id) };


        const updatedDoc = {
          $set: {
            status: newStatus,
            feedback: feedback
          }
        };

        const result = await propertiesCollection.updateOne(filter, updatedDoc);
        res.json(result);

      } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.delete('/properties/admin', async (req, res) => {
      try {
        const { id } = req.body;

        if (!id) {
          return res.status(400).json({ error: "Property ID is required" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await propertiesCollection.deleteOne(query);

        res.json(result);
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });


    app.get('/users', async (req, res) => {
      try {
        const users = await userCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch('/users/role', async (req, res) => {
      try {
        const { id, role } = req.body;
        if (!id || !role) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: { role: role }
        };

        const result = await userCollection.updateOne(filter, updatedDoc);
        res.json(result);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });


    app.delete('/users', async (req, res) => {
      try {
        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ error: "User ID is required" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });


    app.post('/reviews', async (req, res) => {
      const newReview = req.body;
      const result = await reviewsCollection.insertOne(newReview)
      res.json(result)
    })

    // POST: Add to favorites
    app.post('/favorites', async (req, res) => {
      try {
        const favorites = req.body;
        const result = await favoritesCollection.insertOne(favorites);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error in POST /favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // GET: Get all favorites
    app.get('/favorites', async (req, res) => {
      try {
        const cursor = favoritesCollection.find({});
        const result = await cursor.toArray();
        res.json(result);
      } catch (error) {
        console.error("Error in GET /favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // GET: Check if favorite (এটি /favorites এর আগে বা পরে থাকতে পারে, সমস্যা নেই)
    app.get("/favorites/check", async (req, res) => {
      try {
        const { email, propertyId } = req.query;

        if (!email || !propertyId) {
          return res.status(400).json({ isFavorite: false, message: "Missing query parameters" });
        }

        const favorite = await favoritesCollection.findOne({
          tenantEmail: email,
          propertyId: propertyId
        });

        if (favorite) {
          return res.json({ isFavorite: true, favoriteId: favorite._id });
        } else {
          return res.json({ isFavorite: false });
        }
      } catch (error) {
        console.error("Error in /favorites/check:", error);
        res.status(500).json({ isFavorite: false, error: "Internal server error" });
      }
    });

    // DELETE: Remove from favorites
    app.delete('/favorites', async (req, res) => {
      try {
        const { favItemId, tenantEmail } = req.query;

        if (!favItemId || !tenantEmail) {
          return res.status(400).json({ error: "Missing parameters" });
        }

        // ObjectId ভ্যালিডেশন (সার্ভার ক্র্যাশ রোধ করতে)
        if (!ObjectId.isValid(favItemId)) {
          return res.status(400).json({ error: "Invalid Favorite Item ID format" });
        }

        const query = {
          _id: new ObjectId(favItemId),
          tenantEmail: tenantEmail
        };

        const removedDoc = await favoritesCollection.deleteOne(query);
        res.json(removedDoc);
      } catch (error) {
        console.error("Error in DELETE /favorites:", error);
        res.status(500).json({ error: "Failed to remove from favorites" });
      }
    });

    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData)
      res.json(result)
    })

    app.post('/payment-success', async (req, res) => {
      try {
        const { bookingId, sessionId, amount, currency, customerEmail } = req.body;

        if (!bookingId || !sessionId) {
          return res.status(400).json({ success: false, message: "Booking ID and Session ID are required" });
        }


        const filter = { _id: new ObjectId(bookingId) };
        const updatedDoc = {
          $set: {

            paymentStatus: "Paid"
          }
        };
        const bookingResult = await bookingsCollection.updateOne(filter, updatedDoc);


        const transactionData = {
          bookingId: bookingId,
          stripeSessionId: sessionId,
          amount: amount,
          currency: currency,
          customerEmail: customerEmail,
          paymentStatus: "Success",
          createdAt: new Date()
        };
        const transactionResult = await transactionsCollection.insertOne(transactionData);

        res.status(200).json({
          success: true,
          message: "Booking status updated to Approved and transaction saved!",
          bookingResult,
          transactionResult
        });

      } catch (error) {
        console.error("Error in /payment-success:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
    app.get('/bookings/owner', async (req, res) => {
      const { ownerEmail } = req.query;
      const query = { ownerEmail: ownerEmail };
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray()
      res.json(result)

    });

    app.get('/bookings/tenant', async (req, res) => {
      const { tenantEmail } = req.query;
      const query = { tenantEmail: tenantEmail };
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray()
      res.json(result)

    });



    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})