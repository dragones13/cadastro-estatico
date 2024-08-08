// models/Cliente.js

const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true },
    idade: { type: Number, required: true },
    endereco: { type: String, required: true }
});

module.exports = mongoose.model('Cliente', clienteSchema);
