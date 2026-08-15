// index.js - main
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));

const client = new Client({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers ],
  partials: [ Partials.Channel ]
});

// modules
const wl = require('./wl');
const wlButtons = require('./wl_botoes');
const idModule = require('./id');
const idButtons = require('./id_botoes');
const ticket = require('./ticket');
const ticketButtons = require('./ticket_botoes');

// setup modules (they use internal CONFIG but you can pass overrides here)
wl.setup(client);
wlButtons.setup(client);
idModule.setup(client);
idButtons.setup(client);
ticket.setup(client);
ticketButtons.setup(client);

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// prefix commands
const PREFIX = '!';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'painel-wl') return wl.onPainelCommand(message);
  if (cmd === 'painel-ticket' || cmd === 'ticket') return ticket.onTicketCommand(message);
  if (cmd === 'id') return idModule.onIdCommand(message);
});

// interaction routing (order matters: quiz/ticket/id button handlers)
client.on('interactionCreate', async (interaction) => {
  try {
    if (await wlButtons.handleInteraction(interaction)) return;
    if (await idButtons.handleInteraction(interaction)) return;
    if (await ticketButtons.handleInteraction(interaction)) return;
    // other handlers could go here
  } catch (err) {
    console.error('interactionCreate error', err);
  }
});

// health server (UptimeRobot)
const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
http.createServer(app).listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
  console.log('Health server started');
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não definido!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erro ao logar no Discord:', err);
  process.exit(1);
});