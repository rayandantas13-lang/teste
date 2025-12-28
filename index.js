const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Groq } = require('groq-sdk');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Servir página web simples
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Bot Control</title>
        <style>
            body { font-family: Arial; padding: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background: #d4edda; color: #155724; }
            .disconnected { background: #f8d7da; color: #721c24; }
            #qrcode { margin: 20px 0; }
            .btn { padding: 10px 20px; background: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <h1>🤖 WhatsApp Bot Control</h1>
        <div id="status" class="status disconnected">Desconectado</div>
        <div id="qrcode"></div>
        <button class="btn" onclick="restartBot()">Reiniciar Bot</button>
        
        <script>
            const socket = new WebSocket('ws://' + window.location.host);
            
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'qr') {
                    document.getElementById('qrcode').innerHTML = 
                        '<p>Escaneie este QR Code:</p>' +
                        '<pre style="background: #f0f0f0; padding: 10px;">' + data.qr + '</pre>';
                } else if (data.type === 'ready') {
                    document.getElementById('status').className = 'status connected';
                    document.getElementById('status').textContent = '✅ Conectado!';
                    document.getElementById('qrcode').innerHTML = '';
                }
            };
            
            function restartBot() {
                fetch('/restart', { method: 'POST' });
            }
        </script>
    </body>
    </html>
    `);
});

// Configuração do bot
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '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'
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.CHROMIUM_PATH || undefined
    }
});

// QR Code via terminal e web
client.on('qr', (qr) => {
    console.log('QR Code recebido');
    qrcode.generate(qr, { small: true });
    
    // Enviar via WebSocket para a página web
    server.emit('qr', { type: 'qr', qr });
});

client.on('ready', () => {
    console.log('✅ Bot conectado!');
    server.emit('status', { type: 'ready' });
});

client.on('message', async (msg) => {
    if (msg.from.includes('@g.us')) return; // Ignorar grupos
    
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "Você é um assistente útil e amigável." },
                { role: "user", content: msg.body }
            ],
            temperature: 0.7,
            max_tokens: 500,
        });
        
        const response = completion.choices[0]?.message?.content || "Desculpe, não entendi.";
        await msg.reply(response);
        console.log(`Respondido para ${msg.from}`);
    } catch (error) {
        console.error('Erro:', error);
        await msg.reply("Ops! Tive um problema. Tente novamente.");
    }
});

// Rota para reiniciar
app.post('/restart', (req, res) => {
    client.destroy().then(() => client.initialize());
    res.send('Reiniciando...');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    client.initialize();
});

// WebSocket simples
server.on('connection', (socket) => {
    // Lógica simples para enviar eventos
});