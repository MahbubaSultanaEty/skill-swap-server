const express = require('express');
const app = express();
const cors= require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
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

    // users spi
    app.get("/api/users", async (req, res) => {
      const users = req.query;
      const result = await userCollection.find(users).toArray();
      res.send(result)
    })
    

    // task api
    app.post("/api/tasks", async (req, res) => {
      const task = req.body;
      const result = await taskCollection.insertOne(task);
      res.send(result)
    })

    app.get("/api/tasks", async (req, res) => {
  const result = await taskCollection.find({}).toArray(); 
  res.send(result);
});
       
app.get("/api/tasks/:clientId", async (req, res) => {
  const id = req.params.clientId; 
  const query = { clientId: id };

  const result = await taskCollection.find(query).toArray();
  res.send(result);
});



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