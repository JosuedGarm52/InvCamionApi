const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middlewares
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