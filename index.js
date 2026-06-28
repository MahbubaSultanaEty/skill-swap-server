const express = require('express');
const app = express();
const cors= require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = 5000;

const uri = process.env.MONGO_URI;
app.use(
    cors({
        credentials: true,
        origin: [process.env.CLIENT_URL]
    })
)
app.use(express.json())

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      
    const database = client.db("skill-swap");
    const userCollection = database.collection("user")
    const taskCollection = database.collection("tasks");
    const proposalCollection = database.collection("proposals");
    const plansCollection = database.collection("plans");
    const subscriptionsCollection= database.collection("subscriptions")


    // users spi
    app.get("/api/users", async (req, res) => {
      const users = req.query;
      const result = await userCollection.find(users).toArray();
      res.send(result)
    })
    
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
  res.send(user);
});

    
    
    app.get("/api/freelancers", async (req, res) => {
  const freelancers = await userCollection.find({
    role: "freelancer",
  }).toArray();

  res.send(freelancers);
});
    

    // task api
    app.post("/api/tasks", async (req, res) => {
      const task = req.body;
      const result = await taskCollection.insertOne(task);
      res.send(result)
    })

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

  let tasks = await taskCollection.find(query).toArray();

  if (req.query.budget) {
    const [min, max] = req.query.budget.split("-").map(Number);
    tasks = tasks.filter((t) => {
      const b = Number(t.budget);
      return b >= min && b <= max;
    });
  }

  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 9;
  const skipItems = (page - 1) * perPage;
  const total = tasks.length;
  const paginated = tasks.slice(skipItems, skipItems + perPage);

  res.json({ tasks: paginated, total });
});
    
    app.get("/api/tasks/currentTask/:id", async (req, res) => {
  const id = req.params.id;
  const result = await taskCollection.findOne({ _id: new ObjectId(id) });
  // console.log(result);
  res.send(result);
});
       
app.get("/api/tasks/:clientId", async (req, res) => {
  const id = req.params.clientId; 
  const query = { clientId: id };

  const result = await taskCollection.find(query).toArray();
  res.send(result);
});
  
 
    

    // proposals api
app.get('/api/proposals', async (req, res) => {
  const query = {};
  if (req.query.freelancerEmail) {
     query.freelancerEmail = req.query.freelancerEmail;
  }   
  if (req.query.clientId) {
     query.clientId = req.query.clientId;
  }
   
  const proposals = await proposalCollection.find(query).sort({ submittedAt: -1 }).toArray();
  res.json(proposals);
});
    
 

  app.post('/api/proposals', async (req, res) => {
      const proposal = req.body;
      const newProposal= {
        ...proposal,
        createdAt: new Date()
      }
      const result = await proposalCollection.insertOne(newProposal);
      res.send(result)
    })

    // plans
    app.get("/api/plans", async (req, res) => {
      const query = {}
      if (req.query.plan_id) {
        query.id= req.query.plan_id
      }
      const plan = await plansCollection.findOne(query);
      res.send(plan)
    })

    app.post('/api/subscriptions', async (req, res) => {
      const data = req.body;
      const subInfo = {
        ...data,
        createdAt: new Date()
      }
      const result = await subscriptionsCollection.insertOne(subInfo);
      // update the user plan information
      const filter = { email: data.email };
      const updateDocument = {
        $set: {
          plan: data.planId
        }
      }
      const updatedResult= await userCollection.updateOne(filter, updateDocument)
      res.send(updatedResult)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});