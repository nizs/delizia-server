const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { query } = require('express');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qxen6yj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const userCollection = client.db('delizia').collection('users');
        const menuCollection = client.db('delizia').collection('menu');
        const reviewCollection = client.db('delizia').collection('reviews');
        const cartCollection = client.db('delizia').collection('carts');
        const paymentCollection = client.db('delizia').collection('payments');




        // --------------------
        // JWT related API
        // -----------------------

        // For sending token to the client side
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = await jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })






        // --------------------
        // Middleware API
        // -----------------------

        //verifying token and let the function procced next
        const verifyToken = (req, res, next) => {
            // console.log('Our token from Client side to verify:', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }


        // after verifying token whetere the user is verified user with token of an admin

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'unauthorized access' });
            }
            next();
        }



        // -------------------
        // USER related API
        // -------------------

        // for having all the users data from DB
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // for having admin data with mail
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })

        })


        // inserting user info to DB
        app.post('/users', async (req, res) => {
            const user = req.body;
            // inserted user's email if it doesn't exist to DB
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // updating info to make admin from DB
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // Deleting user data from DB
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


        // --------------------------------------
        // Menu related API
        // --------------------------------------

        // Getting menu data from DB
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })


        // adding item to our menucollection on DB
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {  // todo: need to check if admin route is disable and still other user has acess or not
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            res.send(result);
        })

        //updating menu item to our menucollection on DB
        app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: item.name,
                    recipe: item.recipe,
                    image: item.image,
                    category: item.category,
                    price: item.price
                }
            }
            const result = await menuCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // deleting menu item api on DB
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })



        // -------------------------
        // cart related API
        // -------------------------
        // Get Item according to the user's email
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // Item added to the cart
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        })
        // Deleting item API
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        app.get('/', (req, res) => {
            res.send('Delizia is running');
        })

        app.listen(port, () => {
            console.log(`Delizia is running on port,${port}`);
        })



        // -------------------------
        // review related API
        // -------------------------

        // Getting review data from DB
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        // -------------------------
        // Payment related API
        // -------------------------

        // Payment intent API
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log('amount inside the intent', amount);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        //Payment data from DB
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })


        // Payment data to DB
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            console.log(payment);
            // deleting each item from the cart for which user paid already
            const query = {
                _id: {
                    $in: payment.cartId.map(id => new ObjectId(id))
                }
            };
            const deleteResult = await cartCollection.deleteMany(query);

            res.send({ paymentResult, deleteResult });
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