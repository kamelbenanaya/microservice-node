const express = require('express');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const port = 3002;

// URLs for other microservices
const LIVRES_SERVICE_URL = 'http://localhost:3001'; // Service Livres
const UTILISATEURS_SERVICE_URL = 'http://localhost:3003'; // Service Utilisateurs

app.use(express.json());

// --- Sequelize Setup ---
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './commandes.sqlite' // File-based SQLite database for orders
});

// Define Order Model
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bookId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dateCommande: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'En cours' // Default status
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// --- Swagger Setup ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Service Commandes API',
      version: '1.0.0',
      description: 'API pour la gestion des commandes utilisateurs',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
  },
  apis: ['./index.js'], // Path to the API docs
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- JSDoc Definitions for Swagger ---
/**
 * @swagger
 * tags:
 *   name: Commandes
 *   description: Gestion des commandes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-généré de la commande
 *         userId:
 *           type: integer
 *           description: ID de l'utilisateur ayant passé la commande
 *         bookId:
 *           type: integer
 *           description: ID du livre commandé
 *         dateCommande:
 *           type: string
 *           format: date-time
 *           description: Date de la commande
 *         status:
 *           type: string
 *           description: "Statut de la commande (ex: En cours, Expédiée, Annulée)"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date de création
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date de mise à jour
 *       example:
 *         id: 1
 *         userId: 1
 *         bookId: 2
 *         dateCommande: 2023-01-15T10:30:00Z
 *         status: En cours
 *         createdAt: 2023-01-15T10:30:00Z
 *         updatedAt: 2023-01-15T10:30:00Z
 *     OrderDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/Order'
 *         - type: object
 *           properties:
 *             userName:
 *               type: string
 *               description: Nom de l'utilisateur (récupéré depuis le service Utilisateurs)
 *             bookTitle:
 *               type: string
 *               description: Titre du livre (récupéré depuis le service Livres)
 *           example:
 *             id: 1
 *             userId: 1
 *             bookId: 2
 *             dateCommande: 2023-01-15T10:30:00Z
 *             status: En cours
 *             createdAt: 2023-01-15T10:30:00Z
 *             updatedAt: 2023-01-15T10:30:00Z
 *             userName: Test User
 *             bookTitle: The Great Gatsby
 *     NewOrder:
 *       type: object
 *       required:
 *         - userId
 *         - bookId
 *       properties:
 *         userId:
 *           type: integer
 *         bookId:
 *           type: integer
 *       example:
 *         userId: 1
 *         bookId: 2
 */

// --- Routes --- //

// Basic route
app.get('/', (req, res) => {
  res.send('Service Commandes is running! View API docs at /api-docs');
});

/**
 * @swagger
 * /commandes:
 *   post:
 *     summary: Crée une nouvelle commande
 *     tags: [Commandes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewOrder'
 *     responses:
 *       201:
 *         description: Commande créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Données manquantes (userId ou bookId)
 *       404:
 *         description: Utilisateur ou Livre non trouvé
 *       500:
 *         description: Erreur serveur ou Erreur lors de la communication avec un autre service
 */
app.post('/commandes', async (req, res) => {
  const { userId, bookId } = req.body;

  if (!userId || !bookId) {
    return res.status(400).send('userId et bookId sont requis');
  }

  try {
    // 1. Verify User exists by calling Service Utilisateurs
    try {
      await axios.get(`${UTILISATEURS_SERVICE_URL}/users/${userId}`);
      console.log(`User ${userId} verified successfully.`);
    } catch (error) {
      console.error(`Error verifying user ${userId}:`, error.response?.status, error.response?.data);
      if (error.response && error.response.status === 404) {
        return res.status(404).send(`Utilisateur avec ID ${userId} non trouvé.`);
      }
      return res.status(500).send('Erreur lors de la vérification de l\'utilisateur.');
    }

    // 2. Verify Book exists by calling Service Livres
    let bookDetails;
    try {
      const bookResponse = await axios.get(`${LIVRES_SERVICE_URL}/livres/${bookId}`);
      bookDetails = bookResponse.data; // Store book details if needed later
      console.log(`Book ${bookId} verified successfully: ${bookDetails.title}`);
    } catch (error) {
      console.error(`Error verifying book ${bookId}:`, error.response?.status, error.response?.data);
      if (error.response && error.response.status === 404) {
        return res.status(404).send(`Livre avec ID ${bookId} non trouvé.`);
      }
      return res.status(500).send('Erreur lors de la vérification du livre.');
    }

    // 3. Create Order in the database
    const newOrder = await Order.create({
      userId,
      bookId,
      dateCommande: new Date(),
      status: 'En cours' // Initial status
    });

    console.log(`Order created successfully: ID ${newOrder.id}`);
    res.status(201).json(newOrder);

  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    // Handle potential database errors during Order.create
     if (error.name && error.name.includes('Sequelize')) {
       return res.status(500).send('Erreur base de données lors de la création de la commande.');
     }
    res.status(500).send('Erreur serveur interne lors de la création de la commande.');
  }
});

/**
 * @swagger
 * /commandes:
 *   get:
 *     summary: Récupère la liste de toutes les commandes
 *     tags: [Commandes]
 *     responses:
 *       200:
 *         description: Liste des commandes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OrderDetails'
 *       500:
 *         description: Erreur serveur
 */
app.get('/commandes', async (req, res) => {
  try {
    const orders = await Order.findAll();

    // Enrich each order with user and book details
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        let userName = "Utilisateur inconnu";
        let bookTitle = "Livre inconnu";

        try {
          const [userResponse, bookResponse] = await Promise.all([
            axios.get(`${UTILISATEURS_SERVICE_URL}/users/${order.userId}`).catch(err => {
               console.error(`List: Failed to fetch user ${order.userId}:`, err.response?.status); 
               return null;
            }),
            axios.get(`${LIVRES_SERVICE_URL}/livres/${order.bookId}`).catch(err => {
               console.error(`List: Failed to fetch book ${order.bookId}:`, err.response?.status); 
               return null;
            })
          ]);

          if (userResponse?.data) {
             userName = userResponse.data.name;
          }
          if (bookResponse?.data) {
              bookTitle = bookResponse.data.title;
          }
        } catch (fetchError) {
          console.error(`List: Error fetching related details for order ${order.id}`, fetchError);
          // Continue with default names
        }

        return {
          ...order.get({ plain: true }),
          userName,
          bookTitle
        };
      })
    );

    res.json(enrichedOrders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).send('Erreur serveur lors de la récupération des commandes.');
  }
});

/**
 * @swagger
 * /commandes/{id}:
 *   get:
 *     summary: Récupère les détails d'une commande spécifique par son ID
 *     tags: [Commandes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la commande
 *     responses:
 *       200:
 *         description: Détails de la commande
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderDetails'
 *       400:
 *         description: ID de commande invalide
 *       404:
 *         description: Commande non trouvée
 *       500:
 *         description: Erreur serveur
 */
app.get('/commandes/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
        return res.status(400).send('ID de commande invalide.');
    }

    const order = await Order.findByPk(orderId);

    if (order) {
      // Fetch user and book details in parallel
      let userName = "Utilisateur inconnu";
      let bookTitle = "Livre inconnu";

      try {
        const [userResponse, bookResponse] = await Promise.all([
          axios.get(`${UTILISATEURS_SERVICE_URL}/users/${order.userId}`).catch(err => {
             console.error(`Failed to fetch user ${order.userId}:`, err.response?.status); 
             return null; // Gracefully handle user not found or service error
          }),
          axios.get(`${LIVRES_SERVICE_URL}/livres/${order.bookId}`).catch(err => {
             console.error(`Failed to fetch book ${order.bookId}:`, err.response?.status); 
             return null; // Gracefully handle book not found or service error
          })
        ]);

        if (userResponse?.data) {
           userName = userResponse.data.name;
        }
        if (bookResponse?.data) {
            bookTitle = bookResponse.data.title;
        }

      } catch (fetchError) {
        // This catch block might be redundant due to individual catches above,
        // but included for safety.
        console.error("Error fetching related details for order", orderId, fetchError);
        // We still have the core order details, so we can proceed but log the issue.
      }

      // Combine data
      const enrichedOrder = {
        ...order.get({ plain: true }), // Convert Sequelize object to plain JS object
        userName,
        bookTitle
      };

      res.json(enrichedOrder);

    } else {
      res.status(404).send('Commande non trouvée');
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération de la commande ${req.params.id}:`, error);
    // Fix for lint ID cdc1a65f - Use optional chaining
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Erreur serveur lors de la récupération de la commande.';
    res.status(status).send(message);
  }
});

// TODO: Add route to update order status (e.g., PUT /commandes/:id/status)

// Start server and sync database
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to order database has been established successfully.');
    // Use { force: true } cautiously in dev to drop and recreate tables
    // await sequelize.sync({ force: true });
    await sequelize.sync();
    console.log('Order database synced.');
    app.listen(port, () => {
      console.log(`Service Commandes listening at http://localhost:${port}`);
      console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('Unable to connect to the order database or start server:', error);
  }
};

startServer();
