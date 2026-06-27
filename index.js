
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require('express');
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URI}/api/auth/jwks`))
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader, "authheader")
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ msg: "Unathorization" })
  }

  const token = authHeader.split(" ")[1]
  if (!token) {
    return res.status(401).json({ msg: "Unathorization" })
  }
  try {
    const { payload } = await jwtVerify(token, JWKS)
    req.user = payload
    next()
  } catch (error) {
    console.log(error)
    return res.status(401).json({ msg: "Unathorization" })

  }
}

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
        const { search, type, sort, page = 1, limit = 9 } = req.query;

        // পেজ এবং লিমিট সংখ্যায় রূপান্তর
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let query = { status: "Approved" };
        if (search) {
          query.location = { $regex: search, $options: "i" };
        }

        if (type && type !== "all") {
          query.propertyType = type;
        }

        let sortOption = {};
        if (sort === "low-to-high") {
          sortOption.rent = 1;
        } else if (sort === "high-to-low") {
          sortOption.rent = -1;
        } else {
          sortOption.createdAt = -1;
        }

        // মোট ম্যাচ হওয়া প্রোপার্টির সংখ্যা বের করা (পেজিনেশন ক্যালকুলেশনের জন্য)
        const totalProperties = await propertiesCollection.countDocuments(query);
        const totalPages = Math.ceil(totalProperties / limitNum);

        // ডেটা ফেচ করা
        const properties = await propertiesCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .toArray();

        // অবজেক্ট আকারে মেটাডেটা সহ পাঠানো
        res.json({
          properties,
          totalPages,
          currentPage: pageNum,
          totalProperties
        });
      } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).json({ message: "Server error occurred while fetching properties" });
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


    app.post('/properties/owner', verifyToken, async (req, res) => {
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



    app.get('/admin/properties', async (req, res) => {
      const result = await propertiesCollection.find().toArray();
      res.json(result);

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

    // ==========================================
    // 📊 ADMIN DASHBOARD ANALYTICS API
    // ==========================================
    app.get('/admin/analytics', verifyToken, async (req, res) => {
      try {
        // টোকেন ভ্যালিডেশন এবং রোল চেক (নিরাপত্তার জন্য)
        // নোট: req.user payload-এ যদি 'role' না থাকে, তবে ইমেইল দিয়ে userCollection থেকে রোল ভেরিফাই করতে পারেন।
        const userEmail = req.user?.email;
        if (!userEmail) {
          return res.status(401).json({ error: "Unauthorized access" });
        }

        const adminUser = await userCollection.findOne({ email: userEmail });
        if (!adminUser || adminUser.role !== 'admin') {
          // যদি আপনার টেস্টিং এর সুবিধার্থে রোল চেক শিথিল করতে চান, তবে সাময়িকভাবে এই নিচের লাইনটি কমেন্ট করে রাখতে পারেন
          return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        // ১. টোটাল ইউজার কাউন্ট (আপনার userCollection থেকে)
        const totalUsers = await userCollection.countDocuments({});

        // ২. অ্যাক্টিভ/অ্যাপ্রুভড প্রপার্টি এবং মোট প্রপার্টি সংখ্যা
        const totalProperties = await propertiesCollection.countDocuments({});
        const activeProperties = await propertiesCollection.countDocuments({ status: "Approved" });

        // ৩. মোট বুকিং সংখ্যা
        const totalBookings = await bookingsCollection.countDocuments({});

        // ৪. মোট রেভিনিউ কালেকশন (transactionsCollection থেকে সাকসেসফুল পেমেন্ট যোগফল)
        const totalRevenueData = await transactionsCollection.aggregate([
          { $match: { paymentStatus: "Success" } },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: "$amount" } }
            }
          }
        ]).toArray();
        const totalRevenue = totalRevenueData.length > 0 ? totalRevenueData[0].total : 0;

        // ৫. ডাইনামিক চার্ট ডাটা (গত ১২ মাসের প্ল্যাটফর্ম রেভিনিউ ব্রেকডাউন)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const chartData = await transactionsCollection.aggregate([
          {
            $match: {
              paymentStatus: "Success",
              createdAt: { $gte: twelveMonthsAgo }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              monthlyAmount: { $sum: { $toDouble: "$amount" } }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          {
            $project: {
              _id: 0,
              name: {
                $let: {
                  vars: {
                    monthsInString: [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  },
                  in: { $arrayElemAt: ['$$monthsInString', '$_id.month'] }
                }
              },
              revenue: "$monthlyAmount"
            }
          }
        ]).toArray();

        // ৬. সাম্প্রতিক লাইভ অ্যাক্টিভিটি (সর্বশেষ ৪টি বুকিং/ট্রানজেকশন ট্র্যাকিং)
        const recentBookings = await bookingsCollection.find({})
          .sort({ _id: -1 })
          .limit(4)
          .toArray();

        const recentActivities = recentBookings.map((booking, index) => {
          return {
            id: booking._id,
            type: booking.paymentStatus === "Paid" ? 'booking' : 'property',
            text: `New Booking worth $${booking.totalPrice || booking.rent || 0} by ${booking.tenantEmail || 'Tenant'}`,
            time: 'Recently'
          };
        });

        // যদি কোনো অ্যাক্টিভিটি না থাকে, তবে ডিফল্ট লগ পাঠানো হবে
        if (recentActivities.length === 0) {
          recentActivities.push({ id: 1, type: 'user', text: 'System Online: Monitoring StayNest Database.', time: 'Just now' });
        }

        // ফাইনাল রেসপন্স অবজেক্ট
        res.json({
          success: true,
          summary: {
            totalRevenue,
            revenueChange: "+12.5%", // রিয়েল গ্রোথ ট্রেন্ড ট্র্যাকিং এর জন্য স্ট্যাটিক প্রপস রাখা হয়েছে
            totalUsers,
            userChange: `+${totalUsers > 0 ? 1 : 0} new`,
            activeProperties,
            propertyChange: `${activeProperties}/${totalProperties} Approved`,
            totalBookings,
            bookingChange: "Live status"
          },
          chartData,
          recentActivities
        });

      } catch (error) {
        console.error("Error generating admin dashboard analytics:", error);
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

    // GET: Check if favorite 
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

    app.get('/bookings', async (req, res) => {

      const cursor = bookingsCollection.find();
      const result = await cursor.toArray()
      res.json(result)

    });

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

    app.get('/transactions', async (req, res) => {
      const result = await transactionsCollection.find().toArray()
      res.json(result)
    })
    app.get('/bookings/owner', async (req, res) => {
      const { ownerEmail } = req.query;
      const query = { ownerEmail: ownerEmail };
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray()
      res.json(result)

    });

    // ==========================================
// 🔔 UPDATE BOOKING STATUS (APPROVE/REJECT)
// ==========================================
app.patch('/bookings/status', async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Booking ID and Status are required" });
    }

    // স্টেটাস ভ্যালিডেশন
    if (status !== 'Approved' && status !== 'Rejected') {
      return res.status(400).json({ error: "Invalid status type" });
    }

    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: { status: status }
    };

    const result = await bookingsCollection.updateOne(filter, updatedDoc);
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Booking not found or no change made" });
    }

    res.json({ success: true, message: `Booking status updated to ${status}` });

  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


    app.get('/owner/analytics', verifyToken, async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).json({ error: "Owner email is required" });
        }

        // ১. Total Properties
        const totalProperties = await propertiesCollection.countDocuments({
          "ownerInformation.email": email
        });

        // ২. Total Bookings
        const totalBookings = await bookingsCollection.countDocuments({
          ownerEmail: email
        });

        // ৩. Total Earnings এর জন্য বুকিং ডাটা নিয়ে আসা
        const ownerPaidBookings = await bookingsCollection
          .find({ ownerEmail: email, paymentStatus: "Paid" }, { projection: { _id: 1 } })
          .toArray();

        // যদি কোনো পেইড বুকিং না থাকে, সরাসরি ০ রিটার্ন
        if (ownerPaidBookings.length === 0) {
          return res.json({
            summary: { totalEarnings: 0, totalProperties, totalBookings },
            chartData: []
          });
        }

        // 💡 টাইপ ফিক্স: আমরা ObjectId এবং String দুই ধরণের আইডি-ই একটি অ্যারেতে রাখব
        const bookingObjectIds = ownerPaidBookings.map(b => b._id);
        const bookingStringIds = ownerPaidBookings.map(b => b._id.toString());
        const allBookingIds = [...bookingObjectIds, ...bookingStringIds];

        // ৪. টোটাল আর্নিং ক্যালকুলেশন (অ্যাগ্রিগেশন)
        const totalEarningsData = await transactionsCollection.aggregate([
          {
            $match: {
              bookingId: { $in: allBookingIds },
              paymentStatus: "Success"
            }
          },
          {
            // 💡 টাইপ ফিক্স: পরিমাণটি যদি স্ট্রিং আকারে থাকে তবে তা সংখ্যায় (Double/Int) রূপান্তর করা হলো
            $group: {
              _id: null,
              total: { $sum: { $toDouble: "$amount" } }
            }
          }
        ]).toArray();

        const totalEarnings = totalEarningsData.length > 0 ? totalEarningsData[0].total : 0;

        // ৫. চার্ট ডাটা ক্যালকুলেশন
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const chartData = await transactionsCollection.aggregate([
          {
            $match: {
              bookingId: { $in: allBookingIds },
              paymentStatus: "Success",
              createdAt: { $gte: twelveMonthsAgo }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              monthlyAmount: { $sum: { $toDouble: "$amount" } } // স্ট্রিং থাকলেও ডাবল এ কনভার্ট হবে
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          {
            $project: {
              _id: 0,
              name: {
                $let: {
                  vars: {
                    monthsInString: [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  },
                  in: { $arrayElemAt: ['$$monthsInString', '$_id.month'] }
                }
              },
              earnings: "$monthlyAmount"
            }
          }
        ]).toArray();

        // ফাইনাল রেসপন্স
        res.json({
          summary: {
            totalEarnings,
            totalProperties,
            totalBookings
          },
          chartData
        });

      } catch (error) {
        console.error("Error fetching owner analytics:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get('/bookings/tenant', async (req, res) => {
      const { tenantEmail } = req.query;
      const query = { tenantEmail: tenantEmail };
      const cursor = bookingsCollection.find(query);
      const result = await cursor.toArray()
      res.json(result)

    });

    // ==========================================
// 🗑️ DELETE OWNER PROPERTY BY ID
// ==========================================
app.delete('/properties/owner/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Property ID is required" });
    }

    const filter = { _id: new ObjectId(id) };
    const result = await propertiesCollection.deleteOne(filter);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ success: true, message: "Property successfully deleted" });

  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


    // ==========================================
// 🔄 ২. UPDATE PROPERTY BY ID
// ==========================================
app.put('/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body; // ফ্রন্টেন্ড থেকে আসা নতুন তথ্য

    if (!id) return res.status(400).json({ error: "Property ID is required" });

    // _id বাদ দিয়ে বাকি ডাটা আপডেট ফিল্ডে রাখা (Mongo যাতে এরর না দেয়)
    delete updatedData._id; 

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedData };

    const result = await propertiesCollection.updateOne(filter, updateDoc);
    if (result.matchedCount === 0) return res.status(404).json({ error: "Property not found" });

    res.json({ success: true, message: "Property successfully updated" });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
    // ==========================================
// 📊 TENANT DASHBOARD ANALYTICS API
// ==========================================
app.get('/tenant/analytics', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Tenant email is required" });
    }

    // ১. টোটাল বুকিং সংখ্যা
    const totalBookings = await bookingsCollection.countDocuments({ tenantEmail: email });

    // ২. ফেভারিট প্রপার্টি সংখ্যা
    const totalFavorites = await favoritesCollection.countDocuments({ tenantEmail: email });

    // ৩. টোটাল লিজ/পেইড বুকিংয়ের মোট খরচ হিসাব করা
    const totalSpentData = await bookingsCollection.aggregate([
      { 
        $match: { 
          tenantEmail: email, 
          paymentStatus: "Paid" 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ["$totalPrice", { $ifNull: ["$rent", 0] }] } } }
        }
      }
    ]).toArray();

    const totalSpent = totalSpentData.length > 0 ? totalSpentData[0].total : 0;

    // ৪. সাম্প্রতিক অ্যাক্টিভিটি (টেন্যান্টের শেষ ৩টি বুকিং)
    const recentBookings = await bookingsCollection.find({ tenantEmail: email })
      .sort({ _id: -1 })
      .limit(3)
      .toArray();

    const recentActivities = recentBookings.map((booking) => ({
      id: booking._id,
      type: booking.paymentStatus === "Paid" ? "payment" : "booking",
      text: booking.paymentStatus === "Paid" 
        ? `Invoice for '${booking.propertyName || 'Property'}' successfully paid.`
        : `Your booking request for '${booking.propertyName || 'Property'}' is registered.`,
      time: "Recently"
    }));

    // কোনো অ্যাক্টিভিটি না থাকলে ডিফল্ট মেসেজ
    if (recentActivities.length === 0) {
      recentActivities.push({ id: "default", type: "system", text: "Welcome to StayNest! Browse properties to start booking.", time: "Just now" });
    }

    // রেসপন্স পাঠানো
    res.json({
      success: true,
      summary: {
        totalBookings,
        totalFavorites,
        totalSpent
      },
      recentActivities
    });

  } catch (error) {
    console.error("Error fetching tenant analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
