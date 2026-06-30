const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();
const port = 5000;

const uri = process.env.MONGO_URI;

app.use(
  cors({
    credentials: true,
    origin: [process.env.CLIENT_URL],
  })
);
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

async function startServer() {
  await client.connect();
  console.log("Connected to MongoDB");

  const database = client.db("skill-swap");
  const userCollection = database.collection("user");
  const taskCollection = database.collection("tasks");
  const proposalCollection = database.collection("proposals");
  const plansCollection = database.collection("plans");
  const subscriptionsCollection = database.collection("subscriptions");
  const reviewCollection = database.collection("reviews");
  const paymentCollection = database.collection("payments");

  // ── Middlewares ──
  const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    try {
      const { payload } = await jwtVerify(token, JWKS);

      const user = await userCollection.findOne({ email: payload.email });
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.log(error);
      return res.status(401).json({ msg: "Unauthorized" });
    }
  };

  const verifyClient = (req, res, next) => {
    if (req.user?.role !== "client") {
      return res.status(403).json({ message: "Forbidden: Clients only" });
    }
    next();
  };

  const verifyFreelancer = (req, res, next) => {
    if (req.user?.role !== "freelancer") {
      return res.status(403).json({ message: "Forbidden: Freelancers only" });
    }
    next();
  };

  const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
  };

  // ── Users API ──
  app.get("/api/users", async (req, res) => {
    const users = req.query;
    const result = await userCollection.find(users).toArray();
    res.send(result);
  });

  app.patch("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, image, title, bio, skills, hourlyRate } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (image !== undefined) updateFields.image = image;
    if (title !== undefined) updateFields.title = title;
    if (bio !== undefined) updateFields.bio = bio;
    if (skills !== undefined) updateFields.skills = skills;
    if (hourlyRate !== undefined) updateFields.hourlyRate = hourlyRate;

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    res.send(result);
  });

  app.get("/api/users/email/:email", async (req, res) => {
    const user = await userCollection.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "Account blocked" });
    }
    res.send(user);
  });

  app.get("/api/freelancers", async (req, res) => {
    const freelancers = await userCollection
      .find({ role: "freelancer" })
      .toArray();
    res.send(freelancers);
  });

  app.patch(
    "/api/users/:id/block",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      const { id } = req.params;
      const { isBlocked } = req.body;

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked } }
      );

      res.send(result);
    }
  );

  // ── Tasks API ──
  app.post("/api/tasks", verifyToken, async (req, res) => {
    const task = req.body;
    const result = await taskCollection.insertOne(task);
    res.send(result);
  });

  app.get("/api/tasks", async (req, res) => {
    const query = {};

    if (req.query.clientEmail) query.clientEmail = req.query.clientEmail;
    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { clientName: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const page = Number(req.query.page) || 1;
    const perPage = Number(req.query.perPage) || 9;
    const skip = (page - 1) * perPage;

    const tasks = await taskCollection
      .find(query)
      .skip(skip)
      .limit(perPage)
      .toArray();

    const total = await taskCollection.countDocuments(query);

    res.json({ tasks, total });
  });

  app.get("/api/tasks/currentTask/:id", async (req, res) => {
    const id = req.params.id;
    const result = await taskCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  app.get("/api/tasks/:clientId", async (req, res) => {
    const id = req.params.clientId;
    const query = { clientId: id };
    const result = await taskCollection.find(query).toArray();
    res.send(result);
  });

  app.patch("/api/tasks/:id/status", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status, deliverable_url } = req.body;

    const updateFields = { status };
    if (deliverable_url) updateFields.deliverable_url = deliverable_url;

    const result = await taskCollection.updateOne(
      { _id: id },
      { $set: updateFields }
    );
    res.send(result);
  });

  app.delete("/api/tasks/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    const result = await taskCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Task not found" });
    }

    res.send({ success: true, message: "Task deleted successfully" });
  });

  // ── Proposals API ──
  app.patch("/api/proposals/:id/status", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status, deliverableUrl, completionDate } = req.body;

    const updateFields = { status };
    if (deliverableUrl) updateFields.deliverableUrl = deliverableUrl;
    if (completionDate) updateFields.completionDate = completionDate;

    const result = await proposalCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    res.send(result);
  });

  app.get("/api/proposals", verifyToken, async (req, res) => {
    const query = {};

    if (req.query.freelancerEmail)
      query.freelancerEmail = req.query.freelancerEmail;
    if (req.query.clientId) query.clientId = req.query.clientId;
    if (req.query.taskId) query.taskId = req.query.taskId;
    if (req.query.status) query.status = req.query.status;

    const proposals = await proposalCollection
      .find(query)
      .sort({ submittedAt: -1 })
      .toArray();

    res.json(proposals);
  });

  app.post(
    "/api/proposals",
    verifyToken,
    verifyFreelancer,
    async (req, res) => {
      const proposal = req.body;
      const newProposal = {
        ...proposal,
        createdAt: new Date(),
      };
      const result = await proposalCollection.insertOne(newProposal);
      res.send(result);
    }
  );

  // ── Plans API ──
  app.get("/api/plans", async (req, res) => {
    const query = {};
    if (req.query.plan_id) {
      query.id = req.query.plan_id;
    }
    const plan = await plansCollection.findOne(query);
    res.send(plan);
  });

  app.post("/api/subscriptions", async (req, res) => {
    const data = req.body;
    const subInfo = {
      ...data,
      createdAt: new Date(),
    };
    const result = await subscriptionsCollection.insertOne(subInfo);

    const filter = { email: data.email };
    const updateDocument = {
      $set: { plan: data.planId },
    };
    const updatedResult = await userCollection.updateOne(
      filter,
      updateDocument
    );
    res.send(updatedResult);
  });

  // ── Reviews API ──
  app.get("/api/reviews", async (req, res) => {
    const query = {};
    if (req.query.revieweeEmail) query.revieweeEmail = req.query.revieweeEmail;
    if (req.query.reviewerEmail) query.reviewerEmail = req.query.reviewerEmail;

    const reviews = await reviewCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(reviews);
  });

  app.post("/api/reviews", verifyToken, verifyClient, async (req, res) => {
    const review = req.body;
    const result = await reviewCollection.insertOne(review);
    res.send(result);
  });

  // ── Payments API ──
  app.get("/api/payments", verifyToken, async (req, res) => {
    const query = {};

    if (req.query.clientEmail) query.clientEmail = req.query.clientEmail;
    if (req.query.freelancerEmail)
      query.freelancerEmail = req.query.freelancerEmail;
    if (req.query.taskId) query.taskId = req.query.taskId;

    const payments = await paymentCollection
      .find(query)
      .sort({ paid_at: -1 })
      .toArray();

    res.json(payments);
  });

  app.post("/api/payments", verifyToken, async (req, res) => {
    const payment = req.body;
    const result = await paymentCollection.insertOne(payment);
    res.send(result);
  });

  console.log("All routes registered");
}

startServer().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app;