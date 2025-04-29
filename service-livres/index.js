const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const port = 3001;

app.use(express.json());

// --- Sequelize Setup ---
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './livres.sqlite' // File-based SQLite database
});

// Define Book Model
const Book = sequelize.define('Book', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER
  }
}, {
  // Other model options
  timestamps: true // Adds createdAt and updatedAt fields
});

// --- Swagger Setup ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Service Livres API',
      version: '1.0.0',
      description: 'API pour la gestion du catalogue de livres',
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

// --- Routes --- //

/**
 * @swagger
 * tags:
 *   name: Livres
 *   description: Gestion des livres
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Book:
 *       type: object
 *       required:
 *         - title
 *         - author
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-généré du livre
 *         title:
 *           type: string
 *           description: Titre du livre
 *         author:
 *           type: string
 *           description: Auteur du livre
 *         year:
 *           type: integer
 *           description: Année de publication
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
 *         title: Le Petit Prince
 *         author: Antoine de Saint-Exupéry
 *         year: 1943
 *         createdAt: 2023-01-01T12:00:00Z
 *         updatedAt: 2023-01-01T12:00:00Z
 *     NewBook:
 *       type: object
 *       required:
 *         - title
 *         - author
 *       properties:
 *         title:
 *           type: string
 *         author:
 *           type: string
 *         year:
 *           type: integer
 *       example:
 *         title: L'Étranger
 *         author: Albert Camus
 *         year: 1942
 *     UpdateBook:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         author:
 *           type: string
 *         year:
 *           type: integer
 *       example:
 *         title: L'Étranger (Updated)
 *         year: 1943
 */

// Basic route to check if the service is running
app.get('/', (req, res) => {
  res.send('Service Livres is running! View API docs at /api-docs');
});

/**
 * @swagger
 * /livres:
 *   get:
 *     summary: Récupère la liste de tous les livres
 *     tags: [Livres]
 *     responses:
 *       200:
 *         description: La liste des livres
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Book'
 *       500:
 *         description: Erreur serveur
 */
app.get('/livres', async (req, res) => {
  try {
    const books = await Book.findAll();
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send('Erreur serveur lors de la récupération des livres');
  }
});

/**
 * @swagger
 * /livres/{id}:
 *   get:
 *     summary: Récupère un livre par son ID
 *     tags: [Livres]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID du livre
 *     responses:
 *       200:
 *         description: Détails du livre
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: Livre non trouvé
 *       500:
 *         description: Erreur serveur
 */
app.get('/livres/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const book = await Book.findByPk(bookId);
    if (book) {
      res.json(book);
    } else {
      res.status(404).send('Livre non trouvé');
    }
  } catch (error) {
     console.error(`Error fetching book ${req.params.id}:`, error);
     res.status(500).send('Erreur serveur lors de la récupération du livre');
  }
});

/**
 * @swagger
 * /livres:
 *   post:
 *     summary: Ajoute un nouveau livre
 *     tags: [Livres]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewBook'
 *     responses:
 *       201:
 *         description: Le livre a été créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       400:
 *         description: Données d'entrée invalides
 *       500:
 *         description: Erreur serveur
 */
app.post('/livres', async (req, res) => {
  try {
    const { title, author, year } = req.body;
    if (!title || !author) {
      return res.status(400).send('Titre et auteur sont requis');
    }
    const newBook = await Book.create({ title, author, year });
    res.status(201).json(newBook);
  } catch (error) {
    console.error("Error creating book:", error);
    // Check for validation errors from Sequelize
    if (error.name === 'SequelizeValidationError') {
       return res.status(400).json({ error: error.message, details: error.errors });
    }
    res.status(500).send('Erreur serveur lors de la création du livre');
  }
});

/**
 * @swagger
 * /livres/{id}:
 *   put:
 *     summary: Met à jour un livre existant par son ID
 *     tags: [Livres]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID du livre à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBook'
 *     responses:
 *       200:
 *         description: Livre mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       400:
 *         description: Données d'entrée invalides ou aucun champ fourni
 *       404:
 *         description: Livre non trouvé
 *       500:
 *         description: Erreur serveur
 */
app.put('/livres/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).send('Livre non trouvé');
    }

    const { title, author, year } = req.body;
    // Basic validation - could be more robust
    if (!title && !author && typeof year === 'undefined') {
       return res.status(400).send('Au moins un champ (titre, auteur, année) doit être fourni pour la mise à jour');
    }

    // Update fields only if they are provided in the request body
    if (title) book.title = title;
    if (author) book.author = author;
    if (typeof year !== 'undefined') book.year = year; // Allow updating year to null/0 if intended

    await book.save(); // Save the changes
    res.json(book);
  } catch (error) {
      console.error(`Error updating book ${req.params.id}:`, error);
      if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ error: error.message, details: error.errors });
      }
      res.status(500).send('Erreur serveur lors de la mise à jour du livre');
  }
});

/**
 * @swagger
 * /livres/{id}:
 *   delete:
 *     summary: Supprime un livre par son ID
 *     tags: [Livres]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID du livre à supprimer
 *     responses:
 *       204:
 *         description: Livre supprimé avec succès (pas de contenu)
 *       404:
 *         description: Livre non trouvé
 *       500:
 *         description: Erreur serveur
 */
app.delete('/livres/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const book = await Book.findByPk(bookId);

    if (book) {
      await book.destroy(); // Delete the book
      res.status(204).send(); // No content, successful deletion
    } else {
      res.status(404).send('Livre non trouvé');
    }
  } catch(error) {
      console.error(`Error deleting book ${req.params.id}:`, error);
      res.status(500).send('Erreur serveur lors de la suppression du livre');
  }
});


// Start server and sync database
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to database has been established successfully.');
    await sequelize.sync(); // Sync models - Creates tables if they don't exist
    console.log('Database synced.');
    app.listen(port, () => {
      console.log(`Service Livres listening at http://localhost:${port}`);
      console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error);
  }
};

startServer();
