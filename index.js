const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin:['http://localhost:5173'],
  credentials: true
}));
app.use(express.json())
app.use(cookieParser())

//custom middleware
const logger = (req,res,next)=>{
  console.log(req.method, req.url);
  next()
}

const verifyToken = (req,res,next)=>{
  const token = req?.cookies?.token;
  console.log("from verify", token)
  if(!token){
    return res.status(401).send({Message: "Unauthorized Access"})
  }
  jwt.verify(token,process.env.SECRET_ACCESS_TOKEN, (err,decoded)=>{
    if(err){
      return res.status(401).send({Message : 'Unauthorized Access'})
    }

    req.user = decoded;

    next()
  })
}

app.get('/', (req,res)=>{
    res.send('Car Doctor Is Running')
})

//MongoDB


const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.x4cetjc.mongodb.net/?retryWrites=true&w=majority`;

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

    //create db
    const database = client.db("carDoctor")
    const serviceCollection = database.collection("Services")
    const bookingCollection = database.collection("Booking")

    //auth related api
    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user,process.env.SECRET_ACCESS_TOKEN,{expiresIn: '1h'})

      res
      .cookie('token', token,{
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success : true})
    })

    //Clear token
    app.post('/logout', async(req,res)=>{
      const user = req.body;
      console.log("logging out user", user)
      res
      .clearCookie('token', {maxAge:0})
      .send({success: true})
    })

    //get services data
    app.get('/services', async(req,res)=>{
        const cursor = serviceCollection.find()
        const result = await cursor.toArray()
        res.send(result)
    })

    //get individual services data
    app.get('/services/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id:  new ObjectId(id)}

      // const options ={
      //   projection : {title:1,price:1,service_id:1}
      // }

      const result= await serviceCollection.findOne( query)
      res.send(result)
    })

    //Bookings
    app.post('/bookings', async(req,res)=>{
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.get('/bookings',logger,verifyToken, async(req,res)=>{
      console.log(req.cookies)
      console.log("query email", req.query.email)
      console.log("token owner info", req.user)
      if(req.user.email !== req.query.email){
        return res.status(403).send({Message: 'Forbidden Access'})
      }
      let query={}
      if(req.query?.email){
        query = {email: req.query.email}
      }
      console.log(query);
      const cursor = bookingCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.delete('/bookings/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    app.patch('/bookings/:id', async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedBooking = req.body;
      const updatedDoc = {
        $set:{
          status: updatedBooking.status
        }
      }

      const result = await bookingCollection.updateOne(filter,updatedDoc)
      res.send(result)
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


app.listen(port, ()=>{
    console.log(`Car Doctor is running on port : ${port}`);
})