const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI;

// Middleware Configurations
app.use(cors());
app.use(express.json());

// Root Endpoint
app.get('/', (req, res) => {
  res.send('StayNest API Server is Running');
});

// MongoDB Client Initialization
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Authentication Middleware via JWKS
const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URI}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Unauthorized: Missing or invalid token format" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ msg: "Unauthorized: Token not found" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(401).json({ msg: "Unauthorized: Invalid or expired token" });
  }
};

async function run() {
  try {

    
    // Database and Collections Setup
    const database = client.db("StayNest");
    const propertiesCollection = database.collection("properties");
    const reviewsCollection = database.collection("reviews");
    const bookingsCollection = database.collection("bookings");
    const transactionsCollection = database.collection("transactions");
    const favoritesCollection = database.collection("favorites");
    const userCollection = database.collection("user");

    // ==========================================
    // 🏠 PROPERTY MANAGEMENT ENDPOINTS
    // ==========================================

/**
     * @route GET /properties
     * @desc Get all approved properties with pagination, search, and filtering (Public)
     */
    app.get('/properties', async (req, res) => {
      try {
        const { search, type, sort, page = 1, limit = 9 } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 9;
        const skip = (pageNum - 1) * limitNum;

        let query = { status: "Approved" }; 
        
        if (search) {
          query.location = { $regex: search, $options: "i" };
        }
        
        if (type && type !== "all" && type !== "") {
          query.propertyType = { $regex: `^${type}$`, $options: "i" };
        }

        let sortOption = {};
        if (sort === "low-to-high") {
          sortOption.rent = 1;
        } else if (sort === "high-to-low") {
          sortOption.rent = -1;
        } else {
          sortOption.createdAt = -1;
        }

        const totalProperties = await propertiesCollection.countDocuments(query);
        const totalPages = Math.ceil(totalProperties / limitNum);

        const properties = await propertiesCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limitNum)
          .toArray();

        res.json({
          properties,
          totalPages,
          currentPage: pageNum,
          totalProperties
        });
      } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).json({ message: "Internal server error while fetching properties" });
      }
    });

    /**
     * @route GET /properties/:id
     * @desc Get a specific property details by ID (Public)
     */
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

    /**
     * @route GET /featuredProperties
     * @desc Get top 6 featured properties (Public)
     */
    app.get('/featuredProperties', async (req, res) => {
      try {
        const result = await propertiesCollection.find({}).limit(6).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
      }
    });

    /**
     * @route POST /properties/owner
     * @desc Create a new property listing by an owner (Protected)
     */
    app.post('/properties/owner', verifyToken, async (req, res) => {
      try {
        const propertyData = req.body;
        const result = await propertiesCollection.insertOne(propertyData);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add property", error: error.message });
      }
    });

    /**
     * @route GET /properties/owner/:email
     * @desc Get all properties managed by a specific owner email (Protected)
     */
    app.get('/properties/owner/:email', verifyToken, async (req, res) => {
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

    /**
     * @route PATCH /properties/owner/:id
     * @desc Update an existing property by owner (Protected)
     */
    app.patch('/properties/owner/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        if (!id) return res.status(400).json({ error: "Property ID is required" });

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

    /**
     * @route DELETE /properties/owner/:id
     * @desc Delete a specific property by owner (Protected)
     */
    app.delete('/properties/owner/:id', verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "Property ID is required" });

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
    // 👤 USER MANAGEMENT ENDPOINTS
    // ==========================================

    /**
     * @route GET /users
     * @desc Get all registered users (Protected)
     */
    app.get('/users', verifyToken, async (req, res) => {
      try {
        const users = await userCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    /**
     * @route PATCH /users/role
     * @desc Update a user's role (Protected)
     */
    app.patch('/users/role', verifyToken, async (req, res) => {
      try {
        const { id, role } = req.body;
        if (!id || !role) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: role } };

        const result = await userCollection.updateOne(filter, updatedDoc);
        res.json(result);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    /**
     * @route DELETE /users
     * @desc Delete a user account by ID (Protected)
     */
    app.delete('/users', verifyToken, async (req, res) => {
      try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "User ID is required" });

        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // ==========================================
    // 📅 BOOKING & TRANSACTION ENDPOINTS
    // ==========================================

    app.post('/bookings', verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;
        const result = await bookingsCollection.insertOne(bookingData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/bookings', verifyToken, async (req, res) => {
      try {
        const result = await bookingsCollection.find().toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/bookings/owner', verifyToken, async (req, res) => {
      try {
        const { ownerEmail } = req.query;
        const result = await bookingsCollection.find({ ownerEmail }).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/bookings/tenant', verifyToken, async (req, res) => {
      try {
        const { tenantEmail } = req.query;
        const result = await bookingsCollection.find({ tenantEmail }).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * @route PATCH /bookings/status
     * @desc Approve or Reject booking requests by Owner (Protected)
     */
    app.patch('/bookings/status', verifyToken, async (req, res) => {
      try {
        const { id, status } = req.body;
        if (!id || !status) {
          return res.status(400).json({ error: "Booking ID and Status are required" });
        }
        if (status !== 'Approved' && status !== 'Rejected') {
          return res.status(400).json({ error: "Invalid status type" });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { status: status } };
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

    /**
     * @route POST /payment-success
     * @desc Handle triggers on successful Stripe payments (Protected)
     */
    app.post('/payment-success', async (req, res) => {
      try {
        const { bookingId, sessionId, amount, currency, customerEmail } = req.body;
        if (!bookingId || !sessionId) {
          return res.status(400).json({ success: false, message: "Booking ID and Session ID are required" });
        }

        const filter = { _id: new ObjectId(bookingId) };
        const updatedDoc = { $set: { paymentStatus: "Paid" } };
        const bookingResult = await bookingsCollection.updateOne(filter, updatedDoc);

        const transactionData = {
          bookingId,
          stripeSessionId: sessionId,
          amount,
          currency,
          customerEmail,
          paymentStatus: "Success",
          createdAt: new Date()
        };
        const transactionResult = await transactionsCollection.insertOne(transactionData);

        res.status(200).json({
          success: true,
          message: "Booking status updated to Paid and transaction saved!",
          bookingResult,
          transactionResult
        });
      } catch (error) {
        console.error("Error in /payment-success:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.get('/transactions', verifyToken, async (req, res) => {
      try {
        const result = await transactionsCollection.find().toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // ❤️ FAVORITES & REVIEWS ENDPOINTS
    // ==========================================

    app.post('/reviews', verifyToken, async (req, res) => {
      try {
        const result = await reviewsCollection.insertOne(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
 * @route GET /reviews/:propertyId
 * @desc Get all reviews for a specific property (Public/Protected depending on choice)
 */
    app.get('/reviews/:propertyId', async (req, res) => {
      try {
        const { propertyId } = req.params;
        const query = { propertyId: propertyId };

        const reviews = await reviewsCollection.find(query).toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: "Internal Server Error while fetching reviews" });
      }
    });

    /**
 * @route GET /public-reviews
 * @desc Get all tenant reviews for the landing page marquee (Public)
 */
    app.get('/public-reviews', async (req, res) => {
      try {

        const result = await reviewsCollection.find({}).toArray();
        res.json(result);
      } catch (error) {
        console.error("Error fetching public reviews:", error);
        res.status(500).json({ error: "Internal server error while fetching reviews" });
      }
    });

    app.post('/favorites', verifyToken, async (req, res) => {
      try {
        const result = await favoritesCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error in POST /favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });


    app.get('/favorites', verifyToken, async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).json({ error: "Email query parameter is required" });
        }

        const query = { tenantEmail: email.trim() };

        const result = await favoritesCollection.find(query).toArray();

        res.json(result);
      } catch (error) {
        console.error("Error in GET /favorites:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/favorites/check", verifyToken, async (req, res) => {
      try {
        const { email, propertyId } = req.query;
        if (!email || !propertyId) {
          return res.status(400).json({ isFavorite: false, message: "Missing query parameters" });
        }

        const favorite = await favoritesCollection.findOne({ tenantEmail: email, propertyId });
        if (favorite) {
          return res.json({ isFavorite: true, favoriteId: favorite._id });
        }
        res.json({ isFavorite: false });
      } catch (error) {
        console.error("Error in /favorites/check:", error);
        res.status(500).json({ isFavorite: false, error: "Internal server error" });
      }
    });

    app.delete('/favorites', verifyToken, async (req, res) => {
      try {
        const { favItemId, tenantEmail } = req.query;
        if (!favItemId || !tenantEmail) {
          return res.status(400).json({ error: "Missing parameters" });
        }
        if (!ObjectId.isValid(favItemId)) {
          return res.status(400).json({ error: "Invalid Favorite Item ID format" });
        }

        const query = { _id: new ObjectId(favItemId), tenantEmail };
        const removedDoc = await favoritesCollection.deleteOne(query);
        res.json(removedDoc);
      } catch (error) {
        console.error("Error in DELETE /favorites:", error);
        res.status(500).json({ error: "Failed to remove from favorites" });
      }
    });

    // ==========================================
    // ⚙️ ADMINISTRATIVE ENDPOINTS
    // ==========================================

    app.get('/admin/properties', verifyToken, async (req, res) => {
      try {
        const result = await propertiesCollection.find().toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch('/properties/admin', verifyToken, async (req, res) => {
      try {
        const { newStatus, feedback = '' } = req.query;
        const { id } = req.body;

        if (!id) return res.status(400).json({ error: "Property ID is required" });

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { status: newStatus, feedback } };

        const result = await propertiesCollection.updateOne(filter, updatedDoc);
        res.json(result);
      } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
app.patch('/properties/admin/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyTitle, location, rent } = req.body;

    if (!id) return res.status(400).json({ message: "Property ID is required" });

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        propertyTitle,
        location,
        rent: Number(rent)
      }
    };

    const result = await propertiesCollection.updateOne(filter, updateDoc);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({
      acknowledged: result.acknowledged,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
    app.delete('/properties/admin', verifyToken, async (req, res) => {
      try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Property ID is required" });

        const query = { _id: new ObjectId(id) };
        const result = await propertiesCollection.deleteOne(query);
        res.json(result);
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // ==========================================
    // 📊 DASHBOARD & ANALYTICS ENDPOINTS
    // ==========================================

    /**
     * @route GET /admin/analytics
     * @desc Generate platform-wide metrics and performance data for Admin Dashboard (Protected)
     */
    app.get('/admin/analytics', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user?.email;
        if (!userEmail) return res.status(401).json({ error: "Unauthorized access" });

        const adminUser = await userCollection.findOne({ email: userEmail });
        if (!adminUser || adminUser.role !== 'admin') {
          return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        const totalUsers = await userCollection.countDocuments({});
        const totalProperties = await propertiesCollection.countDocuments({});
        const activeProperties = await propertiesCollection.countDocuments({ status: "Approved" });
        const totalBookings = await bookingsCollection.countDocuments({});

        const totalRevenueData = await transactionsCollection.aggregate([
          { $match: { paymentStatus: "Success" } },
          { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
        ]).toArray();
        const totalRevenue = totalRevenueData.length > 0 ? totalRevenueData[0].total : 0;

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
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              monthlyAmount: { $sum: { $toDouble: "$amount" } }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          {
            $project: {
              _id: 0,
              name: {
                $let: {
                  vars: { monthsInString: [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
                  in: { $arrayElemAt: ['$$monthsInString', '$_id.month'] }
                }
              },
              revenue: "$monthlyAmount"
            }
          }
        ]).toArray();

        const recentBookings = await bookingsCollection.find({}).sort({ _id: -1 }).limit(4).toArray();
        const recentActivities = recentBookings.map((booking) => ({
          id: booking._id,
          type: booking.paymentStatus === "Paid" ? 'booking' : 'property',
          text: `New Booking worth $${booking.totalPrice || booking.rent || 0} by ${booking.tenantEmail || 'Tenant'}`,
          time: 'Recently'
        }));

        if (recentActivities.length === 0) {
          recentActivities.push({ id: 1, type: 'user', text: 'System Online: Monitoring StayNest Database.', time: 'Just now' });
        }

        res.json({
          success: true,
          summary: {
            totalRevenue,
            revenueChange: "+12.5%",
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

    /**
     * @route GET /owner/analytics
     * @desc Fetch analytical metrics specific to properties owned by requested user (Protected)
     */
    app.get('/owner/analytics', verifyToken, async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Owner email is required" });

        const totalProperties = await propertiesCollection.countDocuments({ "ownerInformation.email": email });
        const totalBookings = await bookingsCollection.countDocuments({ ownerEmail: email });
        const ownerPaidBookings = await bookingsCollection.find({ ownerEmail: email, paymentStatus: "Paid" }, { projection: { _id: 1 } }).toArray();

        if (ownerPaidBookings.length === 0) {
          return res.json({
            summary: { totalEarnings: 0, totalProperties, totalBookings },
            chartData: []
          });
        }

        const bookingObjectIds = ownerPaidBookings.map(b => b._id);
        const bookingStringIds = ownerPaidBookings.map(b => b._id.toString());
        const allBookingIds = [...bookingObjectIds, ...bookingStringIds];

        const totalEarningsData = await transactionsCollection.aggregate([
          { $match: { bookingId: { $in: allBookingIds }, paymentStatus: "Success" } },
          { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
        ]).toArray();
        const totalEarnings = totalEarningsData.length > 0 ? totalEarningsData[0].total : 0;

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
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              monthlyAmount: { $sum: { $toDouble: "$amount" } }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          {
            $project: {
              _id: 0,
              name: {
                $let: {
                  vars: { monthsInString: [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
                  in: { $arrayElemAt: ['$$monthsInString', '$_id.month'] }
                }
              },
              earnings: "$monthlyAmount"
            }
          }
        ]).toArray();

        res.json({
          summary: { totalEarnings, totalProperties, totalBookings },
          chartData
        });
      } catch (error) {
        console.error("Error fetching owner analytics:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    /**
     * @route GET /tenant/analytics
     * @desc Retrieve summary and personal engagement analytics for specific Tenant (Protected)
     */
    app.get('/tenant/analytics', verifyToken, async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Tenant email is required" });

        const totalBookings = await bookingsCollection.countDocuments({ tenantEmail: email });
        const totalFavorites = await favoritesCollection.countDocuments({ tenantEmail: email });

        const totalSpentData = await bookingsCollection.aggregate([
          { $match: { tenantEmail: email, paymentStatus: "Paid" } },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: { $ifNull: ["$totalPrice", { $ifNull: ["$rent", 0] }] } } }
            }
          }
        ]).toArray();
        const totalSpent = totalSpentData.length > 0 ? totalSpentData[0].total : 0;

        const recentBookings = await bookingsCollection.find({ tenantEmail: email }).sort({ _id: -1 }).limit(3).toArray();
        const recentActivities = recentBookings.map((booking) => ({
          id: booking._id,
          type: booking.paymentStatus === "Paid" ? "payment" : "booking",
          text: booking.paymentStatus === "Paid"
            ? `Invoice for '${booking.propertyName || 'Property'}' successfully paid.`
            : `Your booking request for '${booking.propertyName || 'Property'}' is registered.`,
          time: "Recently"
        }));

        if (recentActivities.length === 0) {
          recentActivities.push({ id: "default", type: "system", text: "Welcome to StayNest! Browse properties to start booking.", time: "Just now" });
        }

        res.json({
          success: true,
          summary: { totalBookings, totalFavorites, totalSpent },
          recentActivities
        });
      } catch (error) {
        console.error("Error fetching tenant analytics:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    console.log("Database connection configured successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Start Server and MongoDB Connection
run().catch(console.dir);

app.listen(port, () => {
  console.log(`StayNest Server listening on port ${port}`);
});
