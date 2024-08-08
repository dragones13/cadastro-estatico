const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Cliente = require('./public/models/Cliente'); // Modelo MongoDB para Cliente

const app = express();
const port = 3000;

mongoose.connect('mongodb://localhost:27017/clientesDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erro de conexão com o MongoDB:'));
db.once('open', () => {
    console.log('Conectado ao MongoDB.');

    // Após conectar ao MongoDB, configurar backup automático
    configureAutomaticBackup();
});

// Middleware para processar JSON e arquivos de formulário
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diretório onde os arquivos SQL serão armazenados
const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}

// Endpoint para download do backup do banco de dados
app.get('/api/download-backup', (req, res) => {
    const backupFilePath = path.join(uploadDirectory, 'backup.json');
    if (fs.existsSync(backupFilePath)) {
        res.download(backupFilePath, 'backup.json');
    } else {
        res.status(404).send('Backup não encontrado.');
    }
});

// Configuração do Multer para upload de arquivo SQL
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        cb(null, 'script.sql');
    }
});

const upload = multer({ storage: storage });

// Endpoint para upload e execução do script SQL
app.post('/api/upload-sql', upload.single('file'), async (req, res) => {
    const sqlFilePath = path.join(uploadDirectory, 'script.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    try {
        // Processar o conteúdo do SQL para inserção no MongoDB
        const linhas = sqlContent.trim().split('\n');
        const data = linhas.map(linha => {
            const partes = linha.trim().split(',');
            const nome = partes[0].trim().replace(/'/g, '');
            const cpf = partes[1].trim().replace(/'/g, '');
            const idade = parseInt(partes[2].trim().replace(/'/g, ''));
            const endereco = partes[3].trim().replace(/'/g, '');
            return { nome, cpf, idade, endereco };
        });

        await Cliente.insertMany(data);

        // Após inserção, atualizar o backup
        updateBackup();

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao processar o script SQL:', error);
        res.status(500).send('Erro ao processar o script SQL.');
    }
});

// Rota para obter todos os clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const clientes = await Cliente.find({});
        res.json(clientes);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).send('Erro ao buscar clientes.');
    }
});

// Rota para obter um cliente pelo ID
app.get('/api/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findById(req.params.id);
        if (!cliente) {
            return res.status(404).send('Cliente não encontrado.');
        }
        res.json(cliente);
    } catch (error) {
        console.error('Erro ao buscar cliente por ID:', error);
        res.status(500).send('Erro ao buscar cliente por ID.');
    }
});

// Rota para criar um novo cliente
app.post('/api/clientes', async (req, res) => {
    try {
        const { nome, cpf, idade, endereco } = req.body;
        const cliente = new Cliente({ nome, cpf, idade, endereco });
        await cliente.save();

        // Após salvar, atualizar o backup
        updateBackup();

        res.status(201).json(cliente);
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).send('Erro ao criar cliente.');
    }
});

// Rota para atualizar um cliente pelo ID
app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { nome, cpf, idade, endereco } = req.body;
        const cliente = await Cliente.findByIdAndUpdate(req.params.id, { nome, cpf, idade, endereco }, { new: true });
        if (!cliente) {
            return res.status(404).send('Cliente não encontrado.');
        }

        // Após atualizar, atualizar o backup
        updateBackup();

        res.json(cliente);
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).send('Erro ao atualizar cliente.');
    }
});

// Rota para deletar um cliente pelo ID
app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const cliente = await Cliente.findByIdAndDelete(req.params.id);
        if (!cliente) {
            return res.status(404).send('Cliente não encontrado.');
        }

        // Após deletar, atualizar o backup
        updateBackup();

        res.send('Cliente deletado com sucesso.');
    } catch (error) {
        console.error('Erro ao deletar cliente:', error);
        res.status(500).send('Erro ao deletar cliente.');
    }
});

// Função para configurar o backup automático do MongoDB
function configureAutomaticBackup() {
    const backupFilePath = path.join(uploadDirectory, 'backup.json');

    // Monitorar alterações no banco de dados
    Cliente.watch().on('change', async (change) => {
        try {
            const clientes = await Cliente.find({});
            fs.writeFileSync(backupFilePath, JSON.stringify(clientes, null, 2));
            console.log('Backup atualizado.');
        } catch (error) {
            console.error('Erro ao atualizar backup:', error);
        }
    });
}

// Função para atualizar o backup manualmente
function updateBackup() {
    const backupFilePath = path.join(uploadDirectory, 'backup.json');
    try {
        const clientes = Cliente.find({});
        fs.writeFileSync(backupFilePath, JSON.stringify(clientes, null, 2));
        console.log('Backup atualizado manualmente.');
    } catch (error) {
        console.error('Erro ao atualizar backup manualmente:', error);
    }
}

// Iniciar servidor na porta especificada
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
