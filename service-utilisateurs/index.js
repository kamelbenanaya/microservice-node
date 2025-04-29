const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const port = 3003;
const saltRounds = 10; // For bcrypt

app.use(express.json());

// --- Sequelize Setup ---
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './utilisateurs.sqlite' // File-based SQLite database for users
});

// Define User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensure email addresses are unique
    validate: {
      isEmail: true // Basic email format validation
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  timestamps: true
});

// --- Swagger Setup ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Service Utilisateurs API',
      version: '1.0.0',
      description: 'API pour la gestion des utilisateurs (inscription, connexion)',
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
 *   name: Utilisateurs
 *   description: Authentification et gestion des utilisateurs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-généré de l'utilisateur
 *         email:
 *           type: string
 *           format: email
 *           description: Adresse email de l'utilisateur
 *         name:
 *           type: string
 *           description: Nom de l'utilisateur
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
 *         email: test@example.com
 *         name: Test User
 *         createdAt: 2023-01-01T12:00:00Z
 *         updatedAt: 2023-01-01T12:00:00Z
 *     NewUser:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - name
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *         name:
 *           type: string
 *       example:
 *         email: newuser@example.com
 *         password: password123
 *         name: New User
 *     LoginCredentials:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *       example:
 *         email: test@example.com
 *         password: password123
 *     LoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *       example:
 *         message: Connexion réussie
 *         user:
 *           id: 1
 *           email: test@example.com
 *           name: Test User
 *           createdAt: 2023-01-01T12:00:00Z
 *           updatedAt: 2023-01-01T12:00:00Z
 */

// --- Routes --- //

// Basic route
app.get('/', (req, res) => {
  res.send('Service Utilisateurs is running! View API docs at /api-docs');
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Enregistre un nouvel utilisateur
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewUser'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Données invalides (email manquant, format email invalide, etc.)
 *       409:
 *         description: L'email est déjà utilisé
 *       500:
 *         description: Erreur serveur
 */
app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).send('Email, mot de passe et nom sont requis');
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user in database
    const newUser = await User.create({
      email,
      password: hashedPassword,
      name
    });

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = newUser.get({ plain: true });
    res.status(201).json(userWithoutPassword);

  } catch (error) {
    console.error("Error during registration:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).send('Cet email est déjà utilisé');
    }
    if (error.name === 'SequelizeValidationError') {
       return res.status(400).json({ error: 'Validation Error', details: error.errors.map(e => e.message) });
    }
    res.status(500).send('Erreur serveur lors de l\'inscription.');
  }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Connecte un utilisateur existant
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCredentials'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Email ou mot de passe manquant
 *       401:
 *         description: Email ou mot de passe invalide
 *       500:
 *         description: Erreur serveur
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Email et mot de passe sont requis');
  }

  try {
    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log('Login attempt failed (user not found):', email);
      return res.status(401).send('Email ou mot de passe invalide');
    }

    // Compare password with hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // In a real app, generate and return a JWT token here
      console.log('Login successful for:', email);
      const { password: _, ...userWithoutPassword } = user.get({ plain: true });
      res.status(200).json({ message: 'Connexion réussie', user: userWithoutPassword });
    } else {
      console.log('Login attempt failed (invalid password):', email);
      res.status(401).send('Email ou mot de passe invalide');
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send('Erreur serveur lors de la connexion.');
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Récupère les détails d'un utilisateur par son ID (protégé dans une vraie app)
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Détails de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
app.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await User.findByPk(userId);

    if (user) {
        const { password: _, ...userWithoutPassword } = user.get({ plain: true });
        res.json(userWithoutPassword);
    } else {
        res.status(404).send('Utilisateur non trouvé');
    }
  } catch(error) {
      console.error(`Error fetching user ${req.params.id}:`, error);
      res.status(500).send('Erreur serveur lors de la récupération de l\'utilisateur.');
  }
});

// TODO: Implement JWT for authentication/authorization

// Start server and sync database
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to user database has been established successfully.');
    // Use { force: true } cautiously in dev to drop and recreate tables
    // await sequelize.sync({ force: true });
    await sequelize.sync();
    console.log('User database synced.');
    app.listen(port, () => {
      console.log(`Service Utilisateurs listening at http://localhost:${port}`);
      console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('Unable to connect to the user database or start server:', error);
  }
};

startServer();
