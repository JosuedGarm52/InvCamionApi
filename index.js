const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { log } = require('console');

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(helmet());

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

const PORT = process.env.PORT || 8883;
const DBTabla = process.env.TABLA || 'camion';

const dataDeBase = {
    host: process.env.HOST || 'localhost',
    user: process.env.USER || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE || 'camiones',
    port: process.env.DBPORT || 3306
};

const {CUENTA, CONTRA, JWT_SECRET} = process.env

const loginUser = async (req, res) => {
    const { usuario, password } = req.body;

    // Verificación de que los datos del cuerpo no sean nulos o vacíos
    if (!usuario || !password) {
        return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
    }

    try {
        if (usuario === CUENTA && password === CONTRA) {
            const token = jwt.sign({ usuario }, JWT_SECRET, { expiresIn: '5m' });//duracion de token 5 minutos
            res.json({ message: "Inicio de sesión exitoso", token: token});
        } else {
            res.status(404).json({ message: "Credenciales incorrectas" });
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error.message); 
        res.status(500).json({ message: "Error en el servidor" }); 
    }
};

// Método para verificar la validez de un token
const verifyTokenValidity = async (token) => {
    try {
        let tokenx = ""
        // Verificar si el token comienza con "Bearer "
        if (token.startsWith("Bearer ")) {
            // Extraer el token puro sin el prefijo "Bearer "
            tokenx = token.slice(7);
        }else{
            console.log("tu token no es Bearer")
        }

        const decoded = await jwt.verify(tokenx, JWT_SECRET);
        // El token es válido
        return { isValid: true, usuario: decoded.usuario };
    } catch (error) {// Si hay un error al verificar el token, significa que no es válido
        return { isValid: false, error: "Token inválido: " + error.message };
    }
};

const pool = mysql.createPool(dataDeBase);

app.get('/', (req, res) => {
    res.send('hello, world!');
});

/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
app.get('/hello', (req, res) => {
    res.send('Hello World!');
});

app.post('/api/auth/login', loginUser);

// Ruta para verificar la validez de un token
app.post('/api/auth/verifyToken', async (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: "Token no proporcionado" });
    }

    const verificationResult = await verifyTokenValidity(token);

    if (verificationResult.isValid) {
        res.json({ message: "El token es válido", usuario: verificationResult.usuario });
    } else {
        res.status(401).json({ message: "El token no es válido", error: verificationResult.error });
    }
});

app.get('/camiones/', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM ${DBTabla}`);
        if (rows.length === 0) {
            res.status(200).json({ mensaje: "La lista está vacía" });
        } else {
            res.json(rows);
        }
    } catch (err) {
        res.status(500).json({ mensaje: "Error de conexión", tipo: err.message, sql: err.sqlMessage });
    }
});

app.get('/camion/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM ${DBTabla} WHERE id = ?`, [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ mensaje: "Camion no encontrado" });
        } else {
            res.json(rows[0]);
        }
    } catch (err) {
        res.status(500).json({ mensaje: "Error al procesar la solicitud", tipo: err.message, sql: err.sqlMessage });
    }
});

app.post("/camion/", async (req, res) => {
    const token = req.headers['authorization'];

    // Verificar la validez del token
    const verificationResult = await verifyTokenValidity(token);

    if (!verificationResult.isValid) {
        return res.status(401).json({ message: "Token inválido", error: verificationResult.error });
    }

    const { color, matricula, conductor, operativo, marca, modelo, dimension, tipo } = req.body;

    if (!color || !matricula || !conductor || !operativo || !marca || !modelo || !dimension || !tipo) {
        res.status(400).json({ mensaje: "Dejaste campos sin llenar" });
        return;
    }

    try {
        const sql = `INSERT INTO ${DBTabla} (color, matricula, conductor, yearOperative, marca, modelo, dimension, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.execute(sql, [color, matricula, conductor, operativo, marca, modelo, dimension, tipo]);

        if (result.affectedRows === 1) {
            res.status(201).json({ mensaje: "Camion creado exitosamente" });
        } else {
            res.status(500).json({ mensaje: "Error al crear el camion" });
        }
    } catch (err) {
        res.status(500).json({ mensaje: "Error de conexión", tipo: err.message, sql: err.sqlMessage });
    }
});

app.delete("/camion/:id", async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({ mensaje: "El parámetro id es obligatorio en la consulta" });
            return;
        }

        const [result] = await pool.execute(`DELETE FROM ${DBTabla} WHERE ID = ?`, [id]);

        if (result.affectedRows === 0) {
            res.json({ mensaje: "Registro no encontrado" });
        } else {
            res.json({ mensaje: "Registro eliminado" });
        }
    } catch (err) {
        res.status(500).json({ mensaje: "Error de conexión", tipo: err.message, sql: err.sqlMessage });
    }
});

app.put("/camion/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.status(400).json({ message: "ID de camión no valido" });
            return;
        }

        const { color, matricula, conductor, yearOperative, marca, modelo, dimension, tipo } = req.body;
        const updates = [];
        const values = [];

        if (color) updates.push('color = ?'), values.push(color);
        if (matricula) updates.push('matricula = ?'), values.push(matricula);
        if (conductor) updates.push('conductor = ?'), values.push(conductor);
        if (yearOperative) updates.push('yearOperative = ?'), values.push(yearOperative);
        if (marca) updates.push('marca = ?'), values.push(marca);
        if (modelo) updates.push('modelo = ?'), values.push(modelo);
        if (dimension) updates.push('dimension = ?'), values.push(dimension);
        if (tipo) updates.push('tipo = ?'), values.push(tipo);

        if (updates.length === 0) {
            res.status(400).json({ message: "No se proporcionaron datos para la actualizacion." });
            return;
        }

        const sql = `UPDATE ${DBTabla} SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        const [result] = await pool.execute(sql, values);

        if (result.affectedRows === 0) {
            res.json({ message: "Ningún camión actualizado" });
        } else {
            res.json({ message: "Camión actualizado exitosamente" });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

app.patch("/camion/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.status(400).json({ message: "ID de camión no válido" });
            return;
        }

        // Extract all fields from the request body
        const { color, matricula, conductor, yearOperative, marca, modelo, dimension, tipo } = req.body;

        // Validate that all fields are provided
        if (!color || !matricula || !conductor || !yearOperative || !marca || !modelo || !dimension || !tipo) {
            res.status(400).json({ message: "Todos los campos son obligatorios" });
            return;
        }

        // Construct the UPDATE query
        const sql = `UPDATE ${DBTabla} SET color = ?, matricula = ?, conductor = ?, yearOperative = ?, marca = ?, modelo = ?, dimension = ?, tipo = ? WHERE id = ?`;
        const values = [color, matricula, conductor, yearOperative, marca, modelo, dimension, tipo, id];

        // Execute the UPDATE query
        const [result] = await pool.execute(sql, values);

        // Handle the update result
        if (result.affectedRows === 0) {
            res.json({ message: "Ningún camión actualizado" });
        } else {
            res.json({ message: "Camión actualizado exitosamente" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
});



app.listen(PORT,(req,resp)=>{
    console.log("Servidor express escuchando: - " + PORT);
});