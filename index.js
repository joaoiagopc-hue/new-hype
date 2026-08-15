// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const DATA_FILE = path.join(__dirname, 'data.json');
// garante data.json
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
}

// cria client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// IMPORTA MÓDULOS (ajustado para sua estrutura de pastas)
const wl = require('./commands/rp/wl');                     // painel WL
const wlButtons = require('./commands/admin/wl_botoes');    // quiz / WL buttons
const idModule = require('./commands/rp/id');               // comando !id
const idButtons = require('./commands/admin/id_botoes');    // buttons que atribuem ID
const ticket = require('./commands/rp/ticket');             // painel ticket
const ticketButtons = require('./commands/admin/ticket_botoes'); // ticket button handlers

// passa config/overrides (opcional) para cada módulo — principalmente o caminho do data file
const commonOptions = { DATA_FILE };

try { wl.setup(client, commonOptions); } catch (e) { console.warn('wl.setup failed', e); }
try { wlButtons.setup(client, commonOptions); } catch (e) { console.warn('wl_botoes.setup failed', e); }
try { idModule.setup(client, commonOptions); } catch (e) { console.warn('id.setup failed', e); }
try { idButtons.setup(client, commonOptions); } catch (e) { console.warn('id_botoes.setup failed', e); }
try { ticket.setup(client, commonOptions); } catch (e) { console.warn('ticket.setup failed', e); }
try { ticketButtons.setup(client, commonOptions); } catch (e) { console.warn('ticket_botoes.setup failed', e); }

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Prefix commands
const PREFIX = '!';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'painel-wl') {
    try { await wl.onPainelCommand(message); } catch (err) { console.error('onPainelCommand error', err); }
    return;
  }

  if (cmd === 'painel-ticket' || cmd === 'ticket') {
    try { await ticket.onTicketCommand(message); } catch (err) { console.error('onTicketCommand error', err); }
    return;
  }

  if (cmd === 'id') {
    try { await idModule.onIdCommand(message); } catch (err) { console.error('onIdCommand error', err); }
    return;
  }
});

// Interaction routing
client.on('interactionCreate', async (interaction) => {
  try {
    // ordem: WL quiz (usuário), ID buttons (staff), tickets
    if (await wlButtons.handleInteraction(interaction)) return;
    if (await idButtons.handleInteraction(interaction)) return;
    if (await ticketButtons.handleInteraction(interaction)) return;
    // outros handlers podem seguir
  } catch (err) {
    console.error('interactionCreate error', err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno.', ephemeral: true }); } catch {}
  }
});

// health server
const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
http.createServer(app).listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
  console.log('Health server listening');
});

// login
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não definido no ambiente!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erro ao logar no Discord:', err);
  process.exit(1);
});